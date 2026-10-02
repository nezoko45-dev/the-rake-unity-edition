using UnityEngine;

public class RakePackageBootstrap : MonoBehaviour
{
    [Header("FBX reference")]
    public GameObject rakeModelReference;
    public bool buildOnPlay = true;
    public float nightStart = 18f;
    public float dayStart = 6f;

    void Awake()
    {
        if (!buildOnPlay) return;
        BuildWorld();
    }

    [ContextMenu("Build Complete Rake World")]
    public void BuildWorld()
    {
        RakeWorldClock clock = FindFirstObjectByType<RakeWorldClock>();
        if (!clock) clock = new GameObject("World Clock").AddComponent<RakeWorldClock>();
        clock.clockTime = 22f;

        RakeAStarGrid grid = FindFirstObjectByType<RakeAStarGrid>();
        if (!grid) { grid = new GameObject("A* Pathfinding Grid").AddComponent<RakeAStarGrid>(); grid.width=80; grid.height=80; grid.cellSize=2f; }

        GameObject rake = GameObject.Find("Rake");
        if (!rake) rake = new GameObject("Rake");
        if (!rake.GetComponent<CharacterController>()) rake.AddComponent<CharacterController>();
        RakeAI ai = rake.GetComponent<RakeAI>();
        if (!ai) ai = rake.AddComponent<RakeAI>();
        ai.grid = grid; ai.worldClock = clock;

        if (rakeModelReference && rake.transform.Find("RakeModel") == null)
        {
            GameObject model = Instantiate(rakeModelReference, rake.transform);
            model.name = "RakeModel";
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.identity;
            ai.animator = model.GetComponentInChildren<Animator>();
        }

        GameObject player = GameObject.Find("Player");
        if (!player)
        {
            player = GameObject.CreatePrimitive(PrimitiveType.Capsule); player.name="Player"; Destroy(player.GetComponent<CapsuleCollider>());
            player.AddComponent<CharacterController>();
            player.AddComponent<RakePlayerController>();
            player.transform.position = new Vector3(0,1,18);
            GameObject cam = new GameObject("Player Camera"); cam.transform.SetParent(player.transform); cam.transform.localPosition=new Vector3(0,.65f,0); cam.AddComponent<Camera>();
            player.GetComponent<RakePlayerController>().playerCamera=cam.GetComponent<Camera>();
        }

        if (!FindFirstObjectByType<RakeForestGenerator>())
        {
            var forest = new GameObject("Forest Terrain").AddComponent<RakeForestGenerator>(); forest.size=160; forest.treeCount=180;
        }
    }
}
