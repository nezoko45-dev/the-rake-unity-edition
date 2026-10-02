using UnityEngine;

public class RakeForestGenerator : MonoBehaviour
{
    public int size = 160;
    public int treeCount = 180;
    public float treeSpacing = 5f;
    public float treeMinHeight = 5f;
    public float treeMaxHeight = 12f;
    public int seed = 1337;
    public LayerMask obstacleLayer;

    [ContextMenu("Generate Forest")]
    public void GenerateForest()
    {
        Random.InitState(seed);
        Transform old = transform.Find("GeneratedForest");
        if (old) DestroyImmediate(old.gameObject);
        GameObject root = new GameObject("GeneratedForest"); root.transform.SetParent(transform);
        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Cube); ground.name="Terrain"; ground.transform.SetParent(root.transform); ground.transform.position=transform.position; ground.transform.localScale=new Vector3(size,.5f,size);
        int layer = Mathf.RoundToInt(Mathf.Log(Mathf.Max(1, obstacleLayer.value),2));
        if (obstacleLayer.value != 0) ground.layer=layer;
        for(int i=0;i<treeCount;i++)
        {
            float x=Random.Range(-size*.48f,size*.48f), z=Random.Range(-size*.48f,size*.48f), h=Random.Range(treeMinHeight,treeMaxHeight);
            GameObject trunk=GameObject.CreatePrimitive(PrimitiveType.Cylinder); trunk.name="Tree"; trunk.transform.SetParent(root.transform); trunk.transform.position=transform.position+new Vector3(x,h*.5f,z); trunk.transform.localScale=new Vector3(.7f,h*.5f,.7f);
            if(obstacleLayer.value!=0) trunk.layer=layer;
            GameObject crown=GameObject.CreatePrimitive(PrimitiveType.Sphere); crown.name="TreeCrown"; crown.transform.SetParent(trunk.transform); crown.transform.localPosition=Vector3.up*.45f; crown.transform.localScale=new Vector3(3.5f,3f,3.5f);
            if(obstacleLayer.value!=0) crown.layer=layer;
        }
    }
}
