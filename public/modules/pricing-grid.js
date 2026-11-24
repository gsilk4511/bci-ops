export const pricingPageSizes = [10, 20, 30, 40, 50, 100, 200, 500];
const collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
export function pricingGridPage(records, {query='', sort='name', page=0, size=10,reveal}={}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = records.filter(row => words.every(word => row.search.includes(word)));
  const descending = sort.startsWith('-');
  const key = descending ? sort.slice(1) : sort;
  const val = row => row[key];
  matches.sort((a,b) => {
    const av=val(a), bv=val(b);
    if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
    return (descending ? -1 : 1) * (typeof av==='number' && typeof bv==='number' ? av-bv : collator.compare(String(av),String(bv)));
  });
  const pages=Math.max(1,Math.ceil(matches.length/size));
  if(reveal!==undefined){const index=matches.indexOf(reveal);if(index>=0)page=Math.floor(index/size);}
  page=Math.max(0,Math.min(page,pages-1));
  return {rows:matches.slice(page*size,(page+1)*size), total:matches.length, pages, page};
}
export function pricingGridControls({sorts, searchLabel='Find items', initial='name'}) {
  return '<div class="filters"><label>'+searchLabel+'<input type="search" data-grid-query></label>'+
    '<label>Sort by<select data-grid-sort>'+sorts.map(([id,label])=>'<option value="'+id+'"'+(id===initial?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
    '<label>Rows per page<select data-grid-size>'+pricingPageSizes.map(n=>'<option>'+n+'</option>').join('')+'</select></label></div>'+
    '<div class="actions"><button type="button" class="secondary small" data-grid-back>Previous page</button>'+
    '<button type="button" class="secondary small" data-grid-next>Next page</button><span data-grid-status role="status"></span></div>';
}
export function mountPricingGrid(container, records, nodeFor) {
  const find=selector=>container.querySelector(selector);
  const query=find('[data-grid-query]'), sort=find('[data-grid-sort]'), size=find('[data-grid-size]');
  const back=find('[data-grid-back]'), next=find('[data-grid-next]'), body=find('tbody'), status=find('[data-grid-status]');
  const state=()=>({query:query.value,sort:sort.value,size:Number(size.value),page});
  let page=0;
  const render=(reveal)=>{
    const result=pricingGridPage(records,{...state(),reveal});
    page=result.page;
    body.replaceChildren(...result.rows.map(nodeFor));
    back.disabled=page===0; next.disabled=page>=result.pages-1;
    status.textContent=result.total ? 'Page '+(page+1)+' of '+result.pages+' · '+result.total+' matching records' : 'No matching records';
  };
  query.addEventListener('input',()=>{page=0;render();});
  query.addEventListener("keydown",event=>{if(event.key==="Enter")event.preventDefault();});
  sort.addEventListener('change',()=>{page=0;render();});
  size.addEventListener('change',()=>{page=0;render();});
  back.onclick=()=>{page--;render();}; next.onclick=()=>{page++;render();};
  render();
  return {reveal(record){query.value='';render(record);}};
}
