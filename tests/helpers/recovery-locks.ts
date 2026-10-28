/** A small Web Locks boundary double. Locks are held until the callback settles. */
export function recoveryLocks(){
  const held=new Set<string>();
  return {request:async(name:string,_options:unknown,callback:(lock:unknown)=>Promise<unknown>)=>{
    if(held.has(name))return callback(null);
    held.add(name);try{return await callback({name});}finally{held.delete(name);}
  }};
}
