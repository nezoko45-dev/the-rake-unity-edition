using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

public class RakeDemoBootstrap : MonoBehaviour
{
#if UNITY_EDITOR
    [MenuItem("Tools/The Rake/Create Demo Scene")]
    public static void CreateDemoScene()
    {
        GameObject root = new GameObject("RakeDemo");
        var clock = root.AddComponent<RakeWorldClock>(); clock.clockTime = 22f;
        var forest = root.AddComponent<RakeForestGenerator>(); forest.size = 160; forest.treeCount = 180;
        var grid = root.AddComponent<RakeAStarGrid>(); grid.width=80; grid.height=80; grid.cellSize=2f;
        GameObject spawn = new GameObject("RakeInitialSpawn"); spawn.transform.position = Vector3.zero + Vector3.up;
        GameObject rake = new GameObject("Rake"); rake.transform.position = spawn.transform.position; rake.AddComponent<CapsuleCollider>(); rake.AddComponent<CharacterController>(); var ai=rake.AddComponent<RakeAI>(); ai.grid=grid; ai.worldClock=clock;
        GameObject player = GameObject.CreatePrimitive(PrimitiveType.Capsule); player.name="Player"; Object.DestroyImmediate(player.GetComponent<CapsuleCollider>()); var cc=player.AddComponent<CharacterController>(); cc.height=2f; cc.radius=.5f; player.transform.position=new Vector3(0,1,18); player.AddComponent<RakePlayerController>();
        GameObject camObj = new GameObject("PlayerCamera"); camObj.transform.SetParent(player.transform); camObj.transform.localPosition=new Vector3(0,.7f,0); camObj.AddComponent<Camera>(); player.GetComponent<RakePlayerController>().playerCamera=camObj.GetComponent<Camera>();
        forest.GenerateForest();
        Selection.activeGameObject=root;
        EditorUtility.SetDirty(root);
        Debug.Log("The Rake demo objects created. Save the scene as Assets/Scenes/RakeDemo.unity and assign your Rake model/Animator.");
    }
#endif
}
