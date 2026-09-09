import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source=readFileSync("supabase/functions/generate-scenario/index.ts","utf8");
const tree=ts.createSourceFile("edge.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declaration=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==="attributeMissionItemLineage")!;
const body=ts.transpileModule(declaration.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function coordinator(unattributed:number, options:{empty?:boolean;providerFail?:boolean}={}) {
  const attribute=vi.fn(async(batch:any[])=>options.providerFail?{ok:false,detail:"provider failure"}:
    {ok:true,claims:batch,model:"fixture",promptInstanceHash:"a".repeat(64),attempts:1});
  const deps={
    collectMissionLineageTargets:()=>Array.from({length:10},(_,i)=>({target_path:"fixture["+i+"]",text:options.empty?"":"目标语"})),
    ITEM_LINEAGE_MAX_BATCH_SIZE:5,
    attributeItemLineageBatch:attribute,
    sha256Hex:async()=>"a".repeat(64),canonicalJson:JSON.stringify,
    CURRENT_ITEM_LINEAGE_PROMPT_VERSION:"fixture",PROVIDER:"fixture",
    buildPendingItemLineage:()=>({coverage_summary:{total_count:10,claimed_count:10-unattributed,unattributed_count:unattributed}}),
  };
  return {attribute,run:new Function(...Object.keys(deps),body+"\nreturn attributeMissionItemLineage;")(...Object.values(deps))};
}
describe("actual Edge attribution coordinator",()=>{
  it.each([0,2,4,10])("returns %i of 10 unattributed claims for professor review",async(count)=>{
    const {run,attribute}=coordinator(count);
    const result=await run({},{},"",()=>({}));
    expect(result.ok).toBe(true);expect(result.itemLineage.coverage_summary.unattributed_count).toBe(count);
    expect(attribute).toHaveBeenCalledTimes(2);
    expect(attribute.mock.calls.every(call=>call[0].length<=5)).toBe(true);
  });
  it("still rejects missing targets before a model call",async()=>{
    const {run,attribute}=coordinator(0,{empty:true});
    expect((await run({},{},"",()=>({}))).ok).toBe(false);expect(attribute).not.toHaveBeenCalled();
  });
  it("still propagates attribution failures",async()=>{
    const {run}=coordinator(0,{providerFail:true});
    expect(await run({},{},"",()=>({}))).toMatchObject({ok:false,detail:expect.stringContaining("provider failure")});
  });
});
