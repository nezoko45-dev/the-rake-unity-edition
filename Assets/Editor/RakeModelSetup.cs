#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class RakeModelSetup
{
    const string FbxPath = "Assets/the rake walking.fbx";
    const string ScenePath = "Assets/Scenes/RakeDemo.unity";
    static RakeModelSetup() { EditorApplication.delayCall += EnsureModel; }

    [MenuItem("Tools/The Rake/Install FBX Rake Model")]
    public static void EnsureModel()
    {
        if (!System.IO.File.Exists(FbxPath)) return;
        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid()) return;
        GameObject existing = GameObject.Find("Rake/Visual") ?? GameObject.Find("RakeVisual");
        if (existing) return;
        GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(FbxPath);
        if (!prefab) { Debug.LogWarning("The Rake FBX is present but Unity has not finished importing it yet."); return; }
        GameObject rake = GameObject.Find("Rake");
        if (!rake) return;
        GameObject visual = (GameObject)PrefabUtility.InstantiatePrefab(prefab, rake.transform);
        visual.name = "Visual";
        visual.transform.localPosition = Vector3.zero;
        visual.transform.localRotation = Quaternion.identity;
        visual.transform.localScale = Vector3.one;
        Animator animator = visual.GetComponentInChildren<Animator>();
        RakeAI ai = rake.GetComponent<RakeAI>();
        if (animator && ai) ai.animator = animator;
        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);
        Debug.Log("Installed Assets/the rake walking.fbx as the Rake visual.");
    }
}
#endif
