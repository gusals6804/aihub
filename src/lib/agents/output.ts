import { z } from "zod";
export function outputShape(raw: string) {
  const shape = z
    .record(z.string().min(1).max(80), z.enum(["string", "number", "boolean"]))
    .parse(JSON.parse(raw));
  if (!Object.keys(shape).length || Object.keys(shape).length > 20)
    throw new Error("출력 항목은 1~20개입니다.");
  return shape;
}
export function validateOutput(text: string, shape: ReturnType<typeof outputShape>) {
  const data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length !== Object.keys(shape).length
  )
    throw new Error("출력 형식 불일치");
  for (const [key, type] of Object.entries(shape))
    if (!Object.hasOwn(data, key) || typeof data[key] !== type) throw new Error("출력 형식 불일치");
  return JSON.stringify(data, null, 2);
}
