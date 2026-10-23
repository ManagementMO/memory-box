export class DatabaseError extends Error {
  constructor(message:string,public code:string,public operation?:string){super(message);this.name="DatabaseError";}
}

/** No messages, SQL, arguments, identifiers, headers or credentials enter logs. */
export function databaseDiagnostic(error:DatabaseError){
  const code=typeof error.code==="string"&&/^(?:[A-Z0-9]{5}|PGRST[0-9]{3}|database_error)$/.test(error.code)?error.code:undefined;
  const operation=typeof error.operation==="string"&&/^(?:mb_[a-z0-9_]{1,60}|assets\.read|reports\.list)$/.test(error.operation)?error.operation:undefined;
  return{kind:"DatabaseError",...(operation?{operation}:{}),...(code?{code}:{})};
}
