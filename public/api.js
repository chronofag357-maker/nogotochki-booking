let csrf='';
export async function api(path,method='GET',data){
 const response=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const result=await response.json();
 if(!response.ok){const error=new Error(`${response.status}: ${result.error}`);error.status=response.status;throw error;}
 if(result.csrf)csrf=result.csrf;
 if(path==='/api/logout')csrf='';
 return result;
}
