using System.Collections.Generic;
using UnityEngine;

public class RakeAStarGrid : MonoBehaviour
{
    [Min(4)] public int width = 80;
    [Min(4)] public int height = 80;
    [Min(0.5f)] public float cellSize = 2f;
    public LayerMask obstacleMask;
    public float obstacleCheckHeight = 2f;
    public float rebuildInterval = 1f;

    private bool[,] walkable;
    private float nextRebuild;
    private Vector3 origin;

    void Awake() { Rebuild(); }
    void Update() { if (Time.time >= nextRebuild) { Rebuild(); nextRebuild = Time.time + rebuildInterval; } }

    public void Rebuild()
    {
        walkable = new bool[width, height];
        origin = transform.position - new Vector3(width * cellSize, 0f, height * cellSize) * 0.5f;
        for (int x = 0; x < width; x++) for (int z = 0; z < height; z++)
        {
            Vector3 p = CellToWorld(new Vector2Int(x, z));
            walkable[x, z] = !Physics.CheckBox(p + Vector3.up, new Vector3(cellSize * .42f, obstacleCheckHeight, cellSize * .42f), Quaternion.identity, obstacleMask, QueryTriggerInteraction.Ignore);
        }
    }

    public Vector2Int WorldToCell(Vector3 world)
    {
        int x = Mathf.RoundToInt((world.x - origin.x) / cellSize);
        int z = Mathf.RoundToInt((world.z - origin.z) / cellSize);
        return new Vector2Int(Mathf.Clamp(x, 0, width - 1), Mathf.Clamp(z, 0, height - 1));
    }

    public Vector3 CellToWorld(Vector2Int c) => origin + new Vector3(c.x * cellSize, 0f, c.y * cellSize);

    public List<Vector3> FindPath(Vector3 startWorld, Vector3 goalWorld)
    {
        if (walkable == null) Rebuild();
        Vector2Int start = WorldToCell(startWorld), goal = WorldToCell(goalWorld);
        start = NearestWalkable(start); goal = NearestWalkable(goal);
        var open = new List<Node>();
        var closed = new HashSet<Vector2Int>();
        var best = new Dictionary<Vector2Int, Node>();
        Node first = new Node(start, null, 0, Heuristic(start, goal)); open.Add(first); best[start] = first;
        while (open.Count > 0)
        {
            int bestIndex = 0;
            for (int i = 1; i < open.Count; i++) if (open[i].F < open[bestIndex].F) bestIndex = i;
            Node current = open[bestIndex]; open.RemoveAt(bestIndex);
            if (current.cell == goal) return BuildPath(current);
            closed.Add(current.cell);
            foreach (Vector2Int n in Neighbors(current.cell))
            {
                if (!IsWalkable(n) || closed.Contains(n)) continue;
                float g = current.G + Vector2Int.Distance(current.cell, n);
                if (!best.TryGetValue(n, out Node known) || g < known.G)
                {
                    Node next = new Node(n, current, g, Heuristic(n, goal)); best[n] = next; open.Add(next);
                }
            }
        }
        return new List<Vector3>();
    }

    private List<Vector3> BuildPath(Node n) { var path = new List<Vector3>(); while (n != null) { path.Add(CellToWorld(n.cell)); n = n.parent; } path.Reverse(); return path; }
    private float Heuristic(Vector2Int a, Vector2Int b) => Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y);
    private bool IsWalkable(Vector2Int c) => c.x >= 0 && c.x < width && c.y >= 0 && c.y < height && walkable[c.x, c.y];
    private Vector2Int NearestWalkable(Vector2Int c) { if (IsWalkable(c)) return c; for (int r = 1; r < 12; r++) for (int x = -r; x <= r; x++) for (int z = -r; z <= r; z++) { var p = new Vector2Int(c.x+x,c.y+z); if (IsWalkable(p)) return p; } return c; }
    private IEnumerable<Vector2Int> Neighbors(Vector2Int c) { for (int x=-1;x<=1;x++) for(int z=-1;z<=1;z++) { if(x==0&&z==0)continue; if(Mathf.Abs(x)+Mathf.Abs(z)==2 && (!IsWalkable(new Vector2Int(c.x+x,c.y)) || !IsWalkable(new Vector2Int(c.x,c.y+z)))) continue; yield return new Vector2Int(c.x+x,c.y+z); } }

    private class Node { public Vector2Int cell; public Node parent; public float G,H; public float F => G+H; public Node(Vector2Int c,Node p,float g,float h){cell=c;parent=p;G=g;H=h;} }
}
