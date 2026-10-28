/** Browser-scoped ownership, held across background tabs until release/unload.
 * Without Web Locks we conservatively copy instead of deleting another record. */
export async function acquireRecoveryLease(key:string):Promise<(()=>void)|null>{
  if(typeof navigator==="undefined"||!navigator.locks?.request)return null;
  return new Promise(resolve=>{
    let release!:()=>void;const held=new Promise<void>(done=>{release=done;});
    void navigator.locks.request(`memory-box:recovery-owner:${key}`,{ifAvailable:true},async lock=>{
      resolve(lock?release:null);if(lock)await held;
    }).catch(()=>resolve(null));
  });
}
