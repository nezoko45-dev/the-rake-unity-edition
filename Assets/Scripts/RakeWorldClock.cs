using UnityEngine;

public class RakeWorldClock : MonoBehaviour
{
    [Range(0f,24f)] public float clockTime = 22f;
    public float hoursPerRealSecond = 0.08f;
    public bool runClock = true;
    public bool autoBuildDemo = true;
    public bool isDay => clockTime >= 6f && clockTime < 18f;
    bool built;

    void Start()
    {
        if (autoBuildDemo) BuildDemoIfNeeded();
    }

    void Update()
    {
        if (runClock) clockTime = Mathf.Repeat(clockTime + hoursPerRealSecond * Time.deltaTime, 24f);
    }

    void BuildDemoIfNeeded()
    {
        if (built || GameObject.Find("Runtime Forest") != null) return;
        built = true;

        var grid = GetComponent<RakeAStarGrid>();
        if (!grid) grid = gameObject.AddComponent<RakeAStarGrid>();
        grid.width = 80; grid.height = 80; grid.cellSize = 2f;

        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Runtime Terrain";
        ground.transform.position = Vector3.zero;
        ground.transform.localScale = Vector3.one * 8f;

        GameObject forest = new GameObject("Runtime Forest");
        Random.InitState(1337);
        for (int i = 0; i < 140; i++)
        {
            float x = Random.Range(-75f, 75f), z = Random.Range(-75f, 75f);
            if (new Vector2(x, z).magnitude < 12f) continue;
            GameObject tree = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tree.name = "Tree";
            tree.transform.SetParent(forest.transform);
            float h = Random.Range(5f, 11f);
            tree.transform.position = new Vector3(x, h * .5f, z);
            tree.transform.localScale = new Vector3(.65f, h * .5f, .65f);
            tree.layer = 8;
            GameObject crown = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            crown.name = "Tree Crown";
            crown.transform.SetParent(tree.transform);
            crown.transform.localPosition = new Vector3(0f, .7f, 0f);
            crown.transform.localScale = new Vector3(5f, 4f, 5f);
            crown.layer = 8;
        }
        grid.obstacleMask = 1 << 8;
        grid.Rebuild();

        GameObject rake = GameObject.Find("Rake");
        if (!rake)
        {
            rake = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            rake.name = "Rake";
            rake.transform.position = Vector3.zero + Vector3.up * 1.5f;
        }
        var rakeCollider = rake.GetComponent<Collider>();
        if (rakeCollider) Destroy(rakeCollider);
        var rakeCC = rake.GetComponent<CharacterController>();
        if (!rakeCC) rakeCC = rake.AddComponent<CharacterController>();
        rakeCC.height = 3f; rakeCC.radius = .6f; rakeCC.center = new Vector3(0, .5f, 0);
        var ai = rake.GetComponent<RakeAI>();
        if (!ai) ai = rake.AddComponent<RakeAI>();
        ai.grid = grid; ai.worldClock = this; ai.walkSpeed = 7f; ai.attackRange = 8f;

        GameObject player = GameObject.Find("Player");
        if (!player)
        {
            player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            player.name = "Player";
            player.transform.position = new Vector3(0, 1f, 20f);
        }
        var pc = player.GetComponent<Collider>();
        if (pc) Destroy(pc);
        var playerCC = player.GetComponent<CharacterController>();
        if (!playerCC) playerCC = player.AddComponent<CharacterController>();
        playerCC.height = 2f; playerCC.radius = .5f; playerCC.center = Vector3.zero;
        var playerController = player.GetComponent<RakePlayerController>();
        if (!playerController) playerController = player.AddComponent<RakePlayerController>();

        GameObject camObject = GameObject.Find("Rake Player Camera");
        if (!camObject)
        {
            camObject = new GameObject("Rake Player Camera");
            camObject.transform.SetParent(player.transform);
            camObject.transform.localPosition = new Vector3(0, .7f, 0);
            camObject.transform.localRotation = Quaternion.identity;
            var camera = camObject.AddComponent<Camera>();
            camera.fieldOfView = 75f;
            camera.nearClipPlane = .03f;
            playerController.playerCamera = camera;
            camera.tag = "MainCamera";
        }
    }
}
