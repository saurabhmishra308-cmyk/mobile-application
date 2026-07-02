import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors, font, radius, spacing } from "@/src/theme";

type Point = { t: number; v: number };

export function LineChart({
  points,
  color = colors.water,
  height = 160,
  width = 320,
  unit = "",
  testID,
}: {
  points: Point[];
  color?: string;
  height?: number;
  width?: number;
  unit?: string;
  testID?: string;
}) {
  const padding = { top: 10, right: 12, bottom: 22, left: 34 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  if (!points.length) {
    return (
      <View
        testID={testID}
        style={[styles.emptyBox, { height }]}
      >
        <Text style={styles.emptyText}>No historical data yet</Text>
      </View>
    );
  }

  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const tSpan = Math.max(tMax - tMin, 1);
  const vSpan = Math.max(vMax - vMin, 1);

  const x = (t: number) => padding.left + ((t - tMin) / tSpan) * w;
  const y = (v: number) => padding.top + h - ((v - vMin) / vSpan) * h;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${x(points[points.length - 1].t).toFixed(1)} ${padding.top + h} L ${x(points[0].t).toFixed(1)} ${padding.top + h} Z`;

  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <View testID={testID}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={padding.left}
            x2={padding.left + w}
            y1={padding.top + f * h}
            y2={padding.top + f * h}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        <Path d={area} fill={`url(#${gradId})`} />
        <Path d={path} stroke={color} strokeWidth={2} fill="none" />
        {points.length <= 60
          ? points.map((p, i) => (
              <Circle
                key={i}
                cx={x(p.t)}
                cy={y(p.v)}
                r={1.6}
                fill={color}
              />
            ))
          : null}
      </Svg>
      <View style={styles.axis}>
        <Text style={styles.axisText}>
          Min {vMin.toFixed(2)}{unit}
        </Text>
        <Text style={styles.axisText}>
          Max {vMax.toFixed(2)}{unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 12 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
  axisText: { color: colors.textMuted, fontSize: 10, fontFamily: font.mono },
});
