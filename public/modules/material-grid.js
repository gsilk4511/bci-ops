export const materialPageSize=10;
export function materialGridPage(rows,requested=0){
 const total=rows.length, pages=Math.max(1,Math.ceil(total/materialPageSize));
 const page=Math.max(0,Math.min(Number.isSafeInteger(requested)?requested:0,pages-1));
 const start=page*materialPageSize;
 return {page,pages,total,start:total?start+1:0,end:Math.min(start+materialPageSize,total),rows:rows.slice(start,start+materialPageSize)};
}
export function validMaterialSelection(choices,id){
 return id?choices.find(item=>item.id===id)||null:null;
}
