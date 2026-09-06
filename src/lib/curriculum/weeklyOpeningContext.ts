import { PdrSchema, PDR_POWER_JSON_TO_ENUM, PDR_DISTANCE_JSON_TO_ENUM } from "@/lib/pragma/coreSchema";

/** 브라우저와 검수 원본이 함께 가진 core_content만 읽는다. 별도 행 컬럼에 의존하지 않는다. */
export function weeklyOpeningContext(core: Record<string, unknown>) {
  const parsed = PdrSchema.safeParse(core.pdr);
  return {
    counterpart: null,
    power: parsed.success ? PDR_POWER_JSON_TO_ENUM[parsed.data.p] : null,
    distance: parsed.success ? PDR_DISTANCE_JSON_TO_ENUM[parsed.data.d] : null,
    burden: parsed.success ? parsed.data.r : null,
    channel: typeof core.channel === "string" ? core.channel : null,
  };
}
