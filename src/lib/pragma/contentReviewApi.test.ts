import {expect,it,vi} from 'vitest';
const invoke=vi.hoisted(()=>vi.fn().mockResolvedValue({data:{contentHash:'current'},error:null}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}));
import {contentReviewRequest} from './contentReviewApi';
it('sends only version hashes when passed a complete inspection snapshot',async()=>{
 const state={contentHash:'current',sourceHash:'source',snapshot:{content:'large source'.repeat(500)},history:[]};
 await contentReviewRequest({kind:'mission',targetId:'mission'},'rules',state);
 expect(invoke).toHaveBeenCalledWith('content-review',{body:{target:{kind:'mission',targetId:'mission'},action:'rules',expectedVersion:{contentHash:'current',sourceHash:'source'}}});
});
