using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class RakeAI : MonoBehaviour
{
    public RakeAStarGrid grid;
    public RakeWorldClock worldClock;
    public Animator animator;
    public float walkSpeed = 7f;
    public float attackRange = 8f;
    public float attackDamage = 25f;
    public float attackCooldown = 1.1f;
    public float targetRefresh = 2f;
    public float health = 100f;
    public float pathRefresh = .35f;
    public float parryDotThreshold = .55f;
    public string attackTrigger = "attack";
    public string parryTrigger = "parry";
    public string walkBool = "walking";
    public string idleBool = "idle";
    public string deathTrigger = "death";

    CharacterController controller;
    Vector3 spawnPosition;
    CharacterController target;
    List<Vector3> path = new List<Vector3>();
    int pathIndex;
    float nextTarget, nextPath, nextAttack;
    bool dead;

    void Awake()
    {
        controller = GetComponent<CharacterController>();
        spawnPosition = transform.position;
        if (!grid) grid = FindFirstObjectByType<RakeAStarGrid>();
        if (!worldClock) worldClock = FindFirstObjectByType<RakeWorldClock>();
    }

    void Update()
    {
        if (dead) return;
        if (worldClock && worldClock.isDay) { Retreat(); return; }
        if (Time.time >= nextTarget || !ValidTarget(target)) { PickRandomPlayer(); nextTarget = Time.time + targetRefresh; }
        if (!target) { StopMoving(); return; }
        if (Vector3.Distance(transform.position, target.transform.position) <= attackRange) AttackTarget();
        else ChaseTarget();
    }

    bool ValidTarget(CharacterController c) => c && c.enabled && c.gameObject.activeInHierarchy && c.GetComponent<RakePlayerController>() != null;

    void PickRandomPlayer()
    {
        CharacterController[] players = FindObjectsByType<CharacterController>(FindObjectsSortMode.None);
        var candidates = new List<CharacterController>();
        foreach (var p in players) if (p != controller && ValidTarget(p)) candidates.Add(p);
        target = candidates.Count == 0 ? null : candidates[Random.Range(0, candidates.Count)];
    }

    void ChaseTarget()
    {
        if (grid && Time.time >= nextPath) { path = grid.FindPath(transform.position, target.transform.position); pathIndex = Mathf.Min(1, path.Count - 1); nextPath = Time.time + pathRefresh; }
        Vector3 destination = path.Count > 0 && pathIndex < path.Count ? path[pathIndex] : target.transform.position;
        MoveToward(destination);
        if (path.Count > 0 && Vector3.Distance(transform.position, destination) < grid.cellSize * .45f) pathIndex++;
    }

    void Retreat()
    {
        if (Vector3.Distance(transform.position, spawnPosition) < 1.5f) { StopMoving(); return; }
        if (grid && Time.time >= nextPath) { path = grid.FindPath(transform.position, spawnPosition); pathIndex = Mathf.Min(1, path.Count - 1); nextPath = Time.time + pathRefresh; }
        Vector3 destination = path.Count > 0 && pathIndex < path.Count ? path[pathIndex] : spawnPosition;
        MoveToward(destination);
        if (path.Count > 0 && Vector3.Distance(transform.position, destination) < grid.cellSize * .45f) pathIndex++;
    }

    void MoveToward(Vector3 destination)
    {
        Vector3 delta = destination - transform.position; delta.y = 0f;
        if (delta.sqrMagnitude < .01f) { StopMoving(); return; }
        transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(delta), 12f * Time.deltaTime);
        controller.Move(delta.normalized * walkSpeed * Time.deltaTime);
        if (animator) { animator.SetBool(walkBool, true); animator.SetBool(idleBool, false); }
    }

    void StopMoving() { if (animator) { animator.SetBool(walkBool, false); animator.SetBool(idleBool, true); } }

    void AttackTarget()
    {
        StopMoving();
        if (Time.time < nextAttack) return;
        nextAttack = Time.time + attackCooldown;
        if (animator) animator.SetTrigger(attackTrigger);
        if (ValidTarget(target)) target.GetComponent<RakePlayerController>()?.TakeDamage(attackDamage);
    }

    public void ReceivePlayerAttack(RakePlayerController player, float damage, Transform cameraTransform)
    {
        if (dead) return;
        Vector3 toRake = (transform.position - cameraTransform.position).normalized;
        bool facingRake = Vector3.Dot(cameraTransform.forward, toRake) >= parryDotThreshold;
        if (facingRake) { if (animator) animator.SetTrigger(parryTrigger); return; }
        health -= damage;
        if (health <= 0f) Die();
    }

    void Die() { dead = true; if (animator) animator.SetTrigger(deathTrigger); controller.enabled = false; }
}
