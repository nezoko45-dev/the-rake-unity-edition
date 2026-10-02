using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class RakePlayerController : MonoBehaviour
{
    public Camera playerCamera;
    public float walkSpeed = 7f;
    public float sprintSpeed = 11f;
    public float jumpHeight = 1.2f;
    public float gravity = -24f;
    public float mouseSensitivity = 2.2f;
    public float maxHealth = 100f;
    public float chargeDamage = 25f;
    public float chargeRange = 8f;
    public float chargeCooldown = .8f;

    CharacterController controller;
    float verticalVelocity, pitch, health;
    float nextAttack;
    bool charging;

    public float Health => health;
    public bool IsCharging => charging;

    void Awake()
    {
        controller = GetComponent<CharacterController>();
        health = maxHealth;
        if (!playerCamera) playerCamera = GetComponentInChildren<Camera>();
        Cursor.lockState = CursorLockMode.Locked;
    }

    void Update()
    {
        Look();
        Move();
        if (Input.GetMouseButtonDown(0) && Time.time >= nextAttack) ChargeAttack();
    }

    void Look()
    {
        float yaw = Input.GetAxis("Mouse X") * mouseSensitivity;
        float lookY = Input.GetAxis("Mouse Y") * mouseSensitivity;
        transform.Rotate(Vector3.up * yaw);
        pitch = Mathf.Clamp(pitch - lookY, -88f, 88f);
        if (playerCamera) playerCamera.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
    }

    void Move()
    {
        float x = Input.GetAxisRaw("Horizontal"), z = Input.GetAxisRaw("Vertical");
        Vector3 move = (transform.right*x + transform.forward*z).normalized;
        float speed = Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : walkSpeed;
        if (controller.isGrounded && verticalVelocity < 0f) verticalVelocity = -2f;
        if (Input.GetButtonDown("Jump") && controller.isGrounded) verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
        verticalVelocity += gravity * Time.deltaTime;
        controller.Move((move * speed + Vector3.up * verticalVelocity) * Time.deltaTime);
    }

    void ChargeAttack()
    {
        nextAttack = Time.time + chargeCooldown;
        charging = true;
        RakeAI rake = FindFirstObjectByType<RakeAI>();
        if (rake && Vector3.Distance(transform.position, rake.transform.position) <= chargeRange) rake.ReceivePlayerAttack(this, chargeDamage, playerCamera ? playerCamera.transform : transform);
        Invoke(nameof(EndCharge), .18f);
    }

    void EndCharge() => charging = false;
    public void TakeDamage(float amount) { health -= amount; if (health <= 0f) Respawn(); }
    void Respawn() { health = maxHealth; controller.enabled = false; transform.position = Vector3.zero + Vector3.up * 2f; controller.enabled = true; }
}
