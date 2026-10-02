using UnityEngine;

public class RakeWorldClock : MonoBehaviour
{
    [Range(0f,24f)] public float clockTime = 22f;
    public float hoursPerRealSecond = 0.08f;
    public bool runClock = true;
    public bool isDay => clockTime >= 6f && clockTime < 18f;

    void Update()
    {
        if (runClock) clockTime = Mathf.Repeat(clockTime + hoursPerRealSecond * Time.deltaTime, 24f);
    }
}
