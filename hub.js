/* Nonclinical hub behavior. Existing learner IDs and storage keys are preserved. */
'use strict';
const SYNC_KEYS=['nur2460_pharm_study_v1','nur2460_fc_anki_v1','studyTheme','nur2460_progress','nur2460_pharm_progress','nur2460_fc_stars','nur2460_fc_collections_v1','nur2460_fc_mastery','nur2460_fc_accuracy','nur2460_fc_schedule','nur2460_fc_state_version','nur2460_study_bookmarks_v1','nur2460_study_box_bookmarks_v1','nur2460_study_notes_v1','nur2460_study_annotations_v1','nur2460_study_last_topic_v1','nur2460_study_view_v1','nur2460_study_header_collapsed_v1','nur2460_templates_progress_v1','nur2460_templates_filters_v1','nur2460_templates_last_v1','nur2460_templates_starred_v1'];
// Kept outside SYNC_KEYS: recovery is device-local, is not nested into exports,
// and survives Reset All so an accidental reset can be undone.
const HUB_BACKUP_KEY='nur2460_hub_recovery_v1';
let hubThemeSession=null;
const HUB_ACTIVE_CARD_IDS=new Set(HUB_CATALOG.activeCardIds);
const HUB_TOPIC_IDS=new Set(HUB_CATALOG.topics.map(row=>row[0]));
const HUB_DRUG_IDS=new Set(HUB_CATALOG.drugs.map(row=>row[0]));
const SEARCH_INDEX=HUB_CATALOG.topics.map(row=>({type:'topic',id:row[0],name:row[1],search:row[1]+' '+row[0].replace(/_/g,' ')+' '+row[2],url:'NUR2460StudyTool.html?topic='+encodeURIComponent(row[0])})).concat(HUB_CATALOG.drugs.map(row=>({type:'drug',id:row[0],name:row[1],examLinked:row[2],search:row[1]+' '+row[0].replace(/[_-]/g,' '),url:'NUR2460Pharmacology.html?drug='+encodeURIComponent(row[0])})));
const hubNode=id=>document.getElementById(id);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeCount=value=>Number.isSafeInteger(value)&&value>=0;
const stateLevel=value=>value===2?2:value===1||value===true?1:0;
function escapeHubText(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function safeRead(key){
  try{
    // Read the active Anki record for dashboard metrics, never rewrite legacy data.
    // Exports/recovery continue to snapshot the native keys independently below.
    if(window.NURMinimalDefault&&window.NURAnkiState?.CARD_KEYS.includes(key)){
      const raw=localStorage.getItem(window.NURAnkiState.KEY);
      if(raw!==null){try{return window.NURAnkiState.parse(raw).cardState[key]}catch{return null}}
    }
    return localStorage.getItem(key);
  }catch{return null}
}
function safeLocalObject(key){try{const value=JSON.parse(safeRead(key)||'{}');return isRecord(value)?value:{}}catch{return{}}}
function setHubHtml(id,html){const el=hubNode(id);if(!el||el.innerHTML===html)return;const focused=el.contains(document.activeElement)?document.activeElement.getAttribute('href'):null;el.innerHTML=html;if(focused){const replacement=[...el.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===focused);replacement?.focus({preventScroll:true})}}
function announceHub(message){hubNode('hubAnnouncement').textContent=message}
function getHubFocusIds(){
  const raw=safeRead('nur2460_fc_collections_v1');
  if(raw!==null){const state=safeLocalObject('nur2460_fc_collections_v1');if(state.version!==1||!isRecord(state.collections))return[];const focus=state.collections.focus||state.collections.reviewer;return Array.isArray(focus?.cardIds)?[...new Set(focus.cardIds.filter(id=>typeof id==='string'&&id))]:[]}
  return Object.entries(safeLocalObject('nur2460_fc_stars')).filter(([,value])=>value===true).map(([id])=>id);
}
function getHubActiveFocusIds(){return getHubFocusIds().filter(id=>HUB_ACTIVE_CARD_IDS.has(id))}
function countHubDueCards(schedule,now,allowed=HUB_ACTIVE_CARD_IDS){return Object.keys(schedule).filter(id=>allowed.has(id)&&Number.isFinite(schedule[id])&&schedule[id]>0&&schedule[id]<=now).length}
function getProgressStats(){
  const study=safeLocalObject('nur2460_progress'),pharm=safeLocalObject('nur2460_pharm_progress'),mastery=safeLocalObject('nur2460_fc_mastery'),accuracy=safeLocalObject('nur2460_fc_accuracy');
  let right=0,total=0;for(const value of Object.values(accuracy)){if(!isRecord(value))continue;const r=safeCount(value.r)?value.r:0,w=safeCount(value.w)?value.w:0;right+=r;total+=r+w}
  return {studyTopics:[...HUB_TOPIC_IDS].filter(id=>stateLevel(study[id])>0).length,studyMastered:[...HUB_TOPIC_IDS].filter(id=>stateLevel(study[id])===2).length,pharmDrugs:[...HUB_DRUG_IDS].filter(id=>stateLevel(pharm[id])>0).length,pharmMastered:[...HUB_DRUG_IDS].filter(id=>stateLevel(pharm[id])===2).length,fcStars:getHubActiveFocusIds().length,fcMastered:[...HUB_ACTIVE_CARD_IDS].filter(id=>safeCount(mastery[id])&&mastery[id]>=3).length,fcAccTotal:total?Math.round(right/total*100):null,fcAttempts:total,templatesStudied:Object.values(safeLocalObject('nur2460_templates_progress_v1').records||{}).filter(v=>v==='studied').length};
}
function renderProgressSummary(){
  const s=getProgressStats();
  const items=[[s.studyTopics+'/'+HUB_CATALOG.counts.topics,'Topics reviewed',s.studyMastered+' marked mastered'],[s.pharmDrugs+'/'+HUB_CATALOG.counts.pharmacology,'Pharmacology reviewed',s.pharmMastered+' marked mastered'],[s.fcStars,'Active cards in Focus','Saved for extra practice'],[s.fcMastered+'/'+HUB_CATALOG.counts.activeCards,'Active cards mastered','Three consecutive correct'],[s.templatesStudied+'/8','Templates studied','Learner-marked state'],[s.fcAccTotal===null?'—':s.fcAccTotal+'%','Overall accuracy',s.fcAttempts?s.fcAttempts+' recorded attempts':'No recorded attempts']];
  setHubHtml('progressSummary',items.map(([value,label,detail])=>'<div class="progress-item"><div class="progress-item-num">'+value+'</div><div class="progress-item-label">'+label+'</div><div class="pickup-meta">'+detail+'</div></div>').join(''));
}
function renderPickupPanel(){
  const last=safeLocalObject('nur2460_study_last_topic_v1'),topic=SEARCH_INDEX.find(e=>e.type==='topic'&&e.id===last.id),bookmarks=safeLocalObject('nur2460_study_bookmarks_v1');
  const saved=SEARCH_INDEX.filter(e=>e.type==='topic'&&bookmarks[e.id]===true),due=countHubDueCards(safeLocalObject('nur2460_fc_schedule'),Date.now()),focus=getHubActiveFocusIds().length;
  const card=(kicker,title,detail,url)=>'<'+(url?'a href="'+url+'"':'div')+' class="pickup-card'+(url?'':' disabled')+'"><div><div class="pickup-kicker">'+kicker+'</div><div class="pickup-name">'+escapeHubText(title)+'</div></div><div class="pickup-meta">'+escapeHubText(detail)+'</div></'+(url?'a':'div')+'>';
  const view=last.mode==='brief'?'Brief review':(last.view==='neo'?'Neo':last.view==='topic'?'Topic Tabs':'ADPIE')+' deep content';
  setHubHtml('pickupGrid',card('Continue topic',topic?.name||'Start your first topic',topic?view:'Begin with the Exam 1 course map.',topic?'NUR2460StudyTool.html?resume=1':'#courseMapTitle')+card(due?'Due review':'Focus Deck',due?due+' cards due':focus?focus+' active cards saved':'No cards due or saved',due?'Open your due-only review session.':focus?'Return to your saved cards.':'Your review queue will appear here.',due?'NUR2460Flashcards.html?mode=due':focus?'NUR2460Flashcards.html?mode=focus':null)+card('Topic bookmarks',saved.length?saved.length+' saved':'No topics saved',saved.length?'Open '+saved[0].name:'Bookmark a topic from the Study Tool.',saved[0]?.url));
}
function renderCourseProgress(){
  const progress=safeLocalObject('nur2460_progress');
  document.querySelectorAll('.exam-item').forEach((item,index)=>{
    const exam=HUB_CATALOG.exams[index];if(!exam)return;
    const links=[...item.querySelectorAll('.exam-link')];
    links.forEach(link=>{const id=new URL(link.href,location.href).searchParams.get('topic'),level=stateLevel(progress[id]);link.dataset.state=level===2?'mastered':level===1?'reviewed':'unreviewed';link.setAttribute('aria-label',link.textContent+' — '+(level===2?'marked mastered':level===1?'reviewed':'not reviewed'))});
    let status=item.querySelector('.exam-progress');if(!status){status=document.createElement('p');status.className='exam-progress';item.appendChild(status)}
    const reviewed=exam.topicIds.filter(id=>stateLevel(progress[id])>0).length,mastered=exam.topicIds.filter(id=>stateLevel(progress[id])===2).length;
    status.textContent=reviewed+'/'+exam.topics+' topics reviewed · '+mastered+' marked mastered';
  });
}
function focusExamRecord(){return HUB_CATALOG.exams.find((exam,index)=>String(index+1)===hubNode('focusExam').value)||null}
function renderWeakSpots(){
  const exam=focusExamRecord(),examNumber=exam?String(HUB_CATALOG.exams.indexOf(exam)+1):null,topicIds=new Set(exam?exam.topicIds:[...HUB_TOPIC_IDS]),drugIds=new Set(exam?exam.drugIds:HUB_CATALOG.drugs.filter(row=>row[2]).map(row=>row[0]));
  const cards=[];
  for(const [type,allowed,key,title] of [['topic',topicIds,'nur2460_progress','Topic study progress'],['drug',drugIds,'nur2460_pharm_progress','Pharmacology study progress']]){
    const state=safeLocalObject(key),records=SEARCH_INDEX.filter(e=>e.type===type&&allowed.has(e.id)),fresh=records.filter(e=>!stateLevel(state[e.id])),reviewed=records.filter(e=>stateLevel(state[e.id])===1),mastered=records.length-fresh.length-reviewed.length;
    cards.push({title,count:records.length,subtitle:fresh.length+' not reviewed · '+reviewed.length+' reviewed · '+mastered+' mastered',items:fresh.concat(reviewed).slice(0,6).map(e=>({name:e.name+' — '+(stateLevel(state[e.id])?'reviewed':'not reviewed'),url:e.url})),empty:'All records in this scope are marked mastered.'});
  }
  const accuracy=safeLocalObject('nur2460_fc_accuracy');
  const allowedGroups=new Set(exam?exam.cardGroups:HUB_CATALOG.exams.flatMap(e=>e.cardGroups));
  const weak=Object.entries(accuracy).filter(([group,v])=>allowedGroups.has(group)&&isRecord(v)&&safeCount(v.r)&&safeCount(v.w)&&v.r+v.w>=3).map(([group,v])=>({group,pct:Math.round(v.r/(v.r+v.w)*100),attempts:v.r+v.w})).filter(v=>v.pct<80).sort((a,b)=>a.pct-b.pct).slice(0,6);
  cards.push({title:'Practice results',count:weak.length,subtitle:'Groups below 80% after at least 3 attempts; a practice signal, not exam readiness.',items:weak.map(v=>({name:(v.group==='Communicable Diseases'?'Acute otitis media':v.group)+' — '+v.pct+'% ('+v.attempts+' attempts)',url:'NUR2460Flashcards.html?mode=review&group='+encodeURIComponent(v.group)+(examNumber?'&exam='+examNumber:'')})),empty:'No groups meet this practice threshold in the selected scope.'});
  const due=countHubDueCards(safeLocalObject('nur2460_fc_schedule'),Date.now(),new Set(exam?exam.cardIds:HUB_CATALOG.activeCardIds));
  cards.push({title:'Scheduled review',count:due,subtitle:due?'Active cards due now':'No active cards due now',items:due?[{name:'Start due-only review →',url:'NUR2460Flashcards.html?mode=due'+(examNumber?'&exam='+examNumber:'')}]:[],empty:'Previously reviewed cards appear here when their review date arrives.'});
  hubNode('weakSpots').style.display='';
  setHubHtml('wsGrid',cards.map(card=>'<section class="ws-card"><div class="ws-card-header"><h3 class="ws-card-title">'+card.title+'</h3><span class="ws-card-count">'+card.count+'</span></div><p class="ws-card-subtitle">'+escapeHubText(card.subtitle)+'</p><div class="ws-items">'+(card.items.length?card.items.map(item=>'<a class="ws-item" href="'+item.url+'">'+escapeHubText(item.name)+'</a>').join(''):'<p class="pickup-meta">'+escapeHubText(card.empty)+'</p>')+'</div></section>').join(''));
}

let hubSearchExpanded=false;
function normalizedSearch(value){return String(value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()}
function rankedHubResults(query){const q=normalizedSearch(query);if(q.length<2)return[];return SEARCH_INDEX.map(entry=>{const name=normalizedSearch(entry.name),search=normalizedSearch(entry.search);return{entry,score:name===q?0:name.startsWith(q)?1:name.includes(q)?2:search.includes(q)?3:99}}).filter(row=>row.score<99).sort((a,b)=>a.score-b.score||a.entry.name.localeCompare(b.entry.name)).map(row=>row.entry)}
function closeHubSearch(){hubNode('hubResults').classList.remove('show');hubNode('hubSearch').setAttribute('aria-expanded','false')}
function hubSearchHandler(query,keepExpanded=false){
  if(!keepExpanded)hubSearchExpanded=false;
  const results=rankedHubResults(query),box=hubNode('hubResults');
  if(normalizedSearch(query).length<2){closeHubSearch();box.innerHTML='';return}
  const shown=hubSearchExpanded?results:results.slice(0,12);
  box.innerHTML='<div class="search-summary">'+(results.length?'Showing '+shown.length+' of '+results.length+' results':'No results for “'+escapeHubText(query)+'”')+'</div>'+shown.map(entry=>'<a class="sr-item" href="'+entry.url+'"><span class="sr-type '+(entry.type==='drug'?'drug':'topic')+'">'+(entry.type==='drug'?'Pharm':'Topic')+'</span><span class="sr-name">'+escapeHubText(entry.name)+'</span><span class="sr-arrow" aria-hidden="true">→</span></a>').join('')+(shown.length<results.length?'<button type="button" class="search-more" onclick="showAllHubResults()">Show all '+results.length+' results</button>':'');
  box.classList.add('show');hubNode('hubSearch').setAttribute('aria-expanded','true');announceHub(results.length+' search results'+(shown.length<results.length?'; first 12 shown':''));
}
function showAllHubResults(){hubSearchExpanded=true;hubSearchHandler(hubNode('hubSearch').value,true);hubNode('hubResults').querySelectorAll('a')[12]?.focus()}

let hubDialog=null,dialogReturnFocus=null,dialogInert=[],dialogOverflow='';
function openHubDialog(id,focusId){
  if(hubDialog)closeHubDialog(false);
  dialogReturnFocus=document.activeElement;hubDialog=hubNode(id);dialogOverflow=document.body.style.overflow;
  dialogInert=[...hubNode('mainContent').children].filter(el=>el!==hubDialog).map(el=>[el,el.inert]);dialogInert.forEach(([el])=>el.inert=true);
  hubDialog.classList.add('show');document.body.style.overflow='hidden';(hubNode(focusId)||hubDialog.querySelector('[role="dialog"]')).focus();
}
function closeHubDialog(restoreFocus=true){if(!hubDialog)return;hubDialog.classList.remove('show');dialogInert.forEach(([el,value])=>el.inert=value);document.body.style.overflow=dialogOverflow;hubDialog=null;if(restoreFocus&&dialogReturnFocus?.isConnected)dialogReturnFocus.focus()}
function trapHubFocus(event,root){
  if(event.key!=='Tab')return;
  const controls=[...root.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]')].filter(el=>!el.hidden&&!el.closest('[hidden]'));
  const first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();root.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus()}
}
function syncGateIsolation(){const gate=hubNode('pwGate'),locked=!gate.classList.contains('hidden');hubNode('mainContent').inert=locked;return locked}

// Backup actions always act on saved data, even in the design preview.
function hubBackupStorage(){return window.localStorage || localStorage}
function snapshotHubState(){const storage=hubBackupStorage(),entries=Object.create(null);SYNC_KEYS.forEach(key=>entries[key]=storage.getItem(key));return entries}
function makeHubExport(){const data={_exportDate:new Date().toISOString(),_version:'NUR2460_v3'};for(const [key,value] of Object.entries(snapshotHubState()))if(value!==null)data[key]=value;return data}
function statusHub(id,message,error=false){const el=hubNode(id);el.className='sync-status '+(error?'error':'success');el.textContent=message}
function exportProgress(){try{hubNode('exportData').value=JSON.stringify(makeHubExport(),null,2);hubNode('exportStatus').className='sync-status';openHubDialog('exportModal','exportData')}catch{announceHub('Browser storage is unavailable. No study state was changed.')}}
async function copyExport(){const field=hubNode('exportData');field.select();try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(field.value)}else if(!document.execCommand('copy'))throw new Error();statusHub('exportStatus','Copied. Save the code somewhere safe.')}catch{statusHub('exportStatus','Automatic copy was unavailable. The code is selected; copy it manually.',true)}}

const KEY_LABELS={nur2460_pharm_study_v1:'Medication notes, highlights, saved items, resume, and study preferences',nur2460_fc_anki_v1:'Anki review, Focus, ratings, and session',studyTheme:'Theme',nur2460_progress:'Topic progress',nur2460_pharm_progress:'Pharmacology progress',nur2460_fc_stars:'Legacy Focus cards',nur2460_fc_collections_v1:'Focus Deck',nur2460_fc_mastery:'Card mastery',nur2460_fc_accuracy:'Practice accuracy',nur2460_fc_schedule:'Review schedule',nur2460_fc_state_version:'Card-state version',nur2460_study_bookmarks_v1:'Topic bookmarks',nur2460_study_box_bookmarks_v1:'Section bookmarks',nur2460_study_notes_v1:'Topic notes',nur2460_study_annotations_v1:'Highlights and passage notes',nur2460_study_last_topic_v1:'Resume history',nur2460_study_view_v1:'Study view',nur2460_study_header_collapsed_v1:'Topic header preference',nur2460_templates_progress_v1:'Template progress',nur2460_templates_filters_v1:'Template filter',nur2460_templates_last_v1:'Template resume',nur2460_templates_starred_v1:'Template stars'};
function validateHubValue(key,raw){
  if(typeof raw!=='string')throw new Error(KEY_LABELS[key]+': expected an exported text value.');
  if(key==='nur2460_pharm_study_v1'){if(!window.NURPharmStudyState)throw new Error('Reload the hub to load medication-study backup support.');window.NURPharmStudyState.parse(raw);return}
  if(key==='nur2460_fc_anki_v1'){if(!window.NURAnkiState)throw new Error('Reload the hub to load Anki backup support.');window.NURAnkiState.parse(raw);return}
  if(key==='studyTheme'){if(!['light','dark'].includes(raw))throw new Error('Invalid theme.');return}
  if(key==='nur2460_study_view_v1'){if(!['adpie','neo','topic'].includes(raw))throw new Error('Invalid study view.');return}
  if(key==='nur2460_study_header_collapsed_v1'){if(!['true','false'].includes(raw))throw new Error('Invalid topic-header preference.');return}
  if(key==='nur2460_fc_state_version'){if(!['1','2'].includes(raw))throw new Error('Unsupported card-state version.');return}
  let value;try{value=JSON.parse(raw)}catch{throw new Error(KEY_LABELS[key]+': invalid JSON.');}
  const valuesMatch=predicate=>isRecord(value)&&Object.values(value).every(predicate),versioned=()=>isRecord(value)&&value.version===1;
  let valid=false;
  switch(key){
    case 'nur2460_progress':case 'nur2460_pharm_progress':valid=valuesMatch(v=>[0,1,2,true,false].includes(v));break;
    case 'nur2460_fc_stars':case 'nur2460_study_bookmarks_v1':valid=valuesMatch(v=>typeof v==='boolean');break;
    case 'nur2460_fc_mastery':valid=valuesMatch(safeCount);break;
    case 'nur2460_fc_schedule':valid=valuesMatch(v=>Number.isFinite(v)&&v>=0);break;
    case 'nur2460_fc_accuracy':valid=valuesMatch(v=>isRecord(v)&&safeCount(v.r??0)&&safeCount(v.w??0));break;
    case 'nur2460_fc_collections_v1':{const focus=value?.collections?.focus||value?.collections?.reviewer;valid=versioned()&&isRecord(value.collections)&&isRecord(focus)&&Array.isArray(focus.cardIds)&&focus.cardIds.every(id=>typeof id==='string'&&id.length>0)&&new Set(focus.cardIds).size===focus.cardIds.length;break;}
    case 'nur2460_study_notes_v1':valid=valuesMatch(v=>typeof v==='string');break;
    case 'nur2460_study_box_bookmarks_v1':valid=valuesMatch(v=>isRecord(v)&&typeof v.topicId==='string'&&typeof v.clusterId==='string'&&typeof v.label==='string');break;
    case 'nur2460_study_annotations_v1':valid=Array.isArray(value)&&value.every(v=>isRecord(v)&&['id','topicId','scopeId'].every(k=>typeof v[k]==='string'&&v[k].length>0)&&['note','text','quote','color','noteFormat','updatedAt','createdAt'].every(k=>v[k]===undefined||typeof v[k]==='string'));break;
    case 'nur2460_study_last_topic_v1':valid=isRecord(value)&&(value.id===undefined||typeof value.id==='string')&&(value.mode===undefined||['brief','deep'].includes(value.mode))&&(value.view===undefined||['adpie','neo','topic'].includes(value.view))&&(value.tab===undefined||typeof value.tab==='string')&&(value.updatedAt===undefined||Number.isFinite(new Date(value.updatedAt).getTime()));break;
    case 'nur2460_templates_progress_v1':valid=versioned()&&isRecord(value.records)&&Object.values(value.records).every(v=>['reviewed','studied'].includes(v));break;
    case 'nur2460_templates_starred_v1':valid=versioned()&&isRecord(value.records)&&Object.values(value.records).every(v=>typeof v==='boolean');break;
    case 'nur2460_templates_filters_v1':valid=versioned()&&typeof value.search==='string';break;
    case 'nur2460_templates_last_v1':valid=versioned()&&typeof value.id==='string'&&(value.mode===undefined||['guided','blank','filled'].includes(value.mode))&&(value.associationId===undefined||typeof value.associationId==='string');break;
  }
  if(!valid)throw new Error(KEY_LABELS[key]+': unsupported or malformed saved-state structure.');
}
function validateHubImport(raw){
  let data;try{data=JSON.parse(raw)}catch{throw new Error('The progress code is not valid JSON.');}
  if(!isRecord(data)||!['NUR2460_v1','NUR2460_v2','NUR2460_v3'].includes(data._version))throw new Error('Unsupported export version. Use an original NUR2460 progress export.');
  const entries=Object.create(null);for(const key of SYNC_KEYS){if(Object.hasOwn(data,key)){validateHubValue(key,data[key]);entries[key]=data[key]}}
  if(!Object.keys(entries).length)throw new Error('This code contains no supported progress categories.');
  // Support legacy stars without discarding retired or unfamiliar stable IDs.
  if(entries.nur2460_fc_stars&&!entries.nur2460_fc_collections_v1){const stars=JSON.parse(entries.nur2460_fc_stars);entries.nur2460_fc_collections_v1=JSON.stringify({version:1,collections:{focus:{name:'Focus Deck',cardIds:Object.keys(stars).filter(id=>stars[id])}}})}
  if(entries.nur2460_fc_collections_v1){const state=JSON.parse(entries.nur2460_fc_collections_v1),focus=state.collections.focus||state.collections.reviewer,mirror=Object.fromEntries(focus.cardIds.map(id=>[id,true]));if(entries.nur2460_fc_stars){const ids=Object.entries(JSON.parse(entries.nur2460_fc_stars)).filter(([,v])=>v).map(([id])=>id);if(ids.length!==focus.cardIds.length||ids.some(id=>!focus.cardIds.includes(id)))throw new Error('Focus Deck and legacy stars disagree. No changes were made.');}else entries.nur2460_fc_stars=JSON.stringify(mirror)}
  return{entries,labels:Object.keys(entries).map(key=>KEY_LABELS[key]),exportDate:typeof data._exportDate==='string'&&Number.isFinite(Date.parse(data._exportDate))?data._exportDate:null};
}
let pendingHubImport=null,pendingHubRecovery=null;
function invalidateImportPreview(){pendingHubImport=null;hubNode('importConfirm').checked=false;hubNode('importConfirm').disabled=true;hubNode('importApply').disabled=true;hubNode('importPreview').textContent='';hubNode('importStatus').className='sync-status'}
function updateImportButton(){hubNode('importApply').disabled=!(pendingHubImport&&hubNode('importConfirm').checked)}
function showImportModal(){hubNode('importData').value='';invalidateImportPreview();openHubDialog('importModal','importData')}
function previewImport(){invalidateImportPreview();try{const raw=hubNode('importData').value.trim(),plan=validateHubImport(raw);pendingHubImport={raw,plan};hubNode('importPreview').textContent='Will replace: '+plan.labels.join(', ')+'. Other categories stay unchanged.';hubNode('importConfirm').disabled=false;statusHub('importStatus','Validated. No saved data has changed. Confirm replacement to continue.')}catch(error){statusHub('importStatus',error.message,true)}}
function readHubBackup(){try{const backup=JSON.parse(hubBackupStorage().getItem(HUB_BACKUP_KEY)||'null');if(!isRecord(backup)||backup.version!==1||!isRecord(backup.entries)||typeof backup.savedAt!=='string'||!Number.isFinite(Date.parse(backup.savedAt)))return null;const oldKeys=SYNC_KEYS.filter(key=>!['nur2460_fc_anki_v1','nur2460_pharm_study_v1'].includes(key));if(!oldKeys.every(key=>Object.hasOwn(backup.entries,key))||!Object.keys(backup.entries).every(key=>SYNC_KEYS.includes(key)&&(backup.entries[key]===null||typeof backup.entries[key]==='string')))return null;if(backup.entries.nur2460_pharm_study_v1!==undefined&&backup.entries.nur2460_pharm_study_v1!==null)validateHubValue('nur2460_pharm_study_v1',backup.entries.nur2460_pharm_study_v1);if(backup.entries.nur2460_fc_anki_v1!==undefined&&backup.entries.nur2460_fc_anki_v1!==null)validateHubValue('nur2460_fc_anki_v1',backup.entries.nur2460_fc_anki_v1);return backup}catch{return null}}
function commitHubState(entries,reason){
  const storage=hubBackupStorage();
  const before=snapshotHubState();
  // A durable backup must succeed before any learner key is touched.
  try{storage.setItem(HUB_BACKUP_KEY,JSON.stringify({version:1,savedAt:new Date().toISOString(),reason,entries:before}))}catch{throw new Error('The recovery backup could not be saved. Nothing was replaced; export a copy and free browser storage first.')}
  const written=[];
  try{for(const [key,value] of Object.entries(entries)){if(!SYNC_KEYS.includes(key))throw new Error('Unexpected progress key');if(before[key]===value)continue;if(value===null)storage.removeItem(key);else storage.setItem(key,value);written.push(key)}}
  catch{let restored=true;try{for(const key of written)storage.removeItem(key);for(const key of written)if(before[key]!==null)storage.setItem(key,before[key])}catch{restored=false}throw new Error(restored?'The write failed; previous progress was restored. The recovery backup remains available.':'The write failed and full rollback could not finish. Do not import again. Use Recover previous progress or your exported backup.')}
  if(storage!==localStorage)for(const [key,value]of Object.entries(entries)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}
  if(Object.hasOwn(entries,'studyTheme'))hubThemeSession=null;
}
function importProgress(){
  if(!pendingHubImport||!hubNode('importConfirm').checked){statusHub('importStatus','Validate the code and confirm replacement first.',true);return}
  if(hubNode('importData').value.trim()!==pendingHubImport.raw){invalidateImportPreview();statusHub('importStatus','The code changed. Validate it again before importing.',true);return}
  try{const plan=validateHubImport(pendingHubImport.raw);commitHubState(plan.entries,'Before import');invalidateImportPreview();refreshHub();statusHub('importStatus','Progress restored. Your previous state is available under Recover previous progress.')}catch(error){refreshHub();statusHub('importStatus',error.message,true)}
}
function showRecoveryModal(){const backup=readHubBackup();if(!backup){announceHub('No readable recovery backup is available.');return}pendingHubRecovery=JSON.stringify(backup);hubNode('recoveryDetails').textContent=backup.reason+' · '+new Date(backup.savedAt).toLocaleString()+'. This restores all backed-up progress, notes, highlights, bookmarks, and preferences.';hubNode('recoveryConfirm').checked=false;hubNode('recoveryStatus').className='sync-status';openHubDialog('recoveryModal','recoveryConfirm')}
function restoreHubBackup(){if(!hubNode('recoveryConfirm').checked){statusHub('recoveryStatus','Confirm replacement before restoring.',true);return}const backup=readHubBackup();if(!backup){statusHub('recoveryStatus','The recovery backup is unreadable. Nothing was changed.',true);return}if(JSON.stringify(backup)!==pendingHubRecovery){hubNode('recoveryConfirm').checked=false;statusHub('recoveryStatus','The backup changed while this dialog was open. Close and reopen recovery to review it; nothing was replaced.',true);return}try{commitHubState(backup.entries,'Before recovery');pendingHubRecovery=null;hubNode('recoveryConfirm').checked=false;refreshHub();statusHub('recoveryStatus','Previous progress restored. The state you replaced is now the recovery backup.')}catch(error){statusHub('recoveryStatus',error.message,true)}}
function confirmReset(){if(!confirm('Reset all study progress, Focus cards, notes, highlights, bookmarks, template stars, and preferences on this device? A recovery backup will be saved first.'))return;if(!confirm('Continue with reset? Export a separate copy if you also want a portable backup.'))return;try{commitHubState(Object.fromEntries(SYNC_KEYS.map(key=>[key,null])),'Before reset');refreshHub();announceHub('Study progress reset. Recover previous progress is available.')}catch(error){announceHub(error.message)}}

function refreshHub(){
  renderProgressSummary();renderPickupPanel();renderCourseProgress();renderWeakSpots();hubNode('recoveryBtn').hidden=!readHubBackup();
  let storageReady=true;try{localStorage.getItem('studyTheme')}catch{storageReady=false}hubNode('hubStorageWarning').hidden=storageReady;
  const saved=hubThemeSession||safeRead('studyTheme'),light=saved==='light'||(!saved&&window.matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.setAttribute('data-theme',light?'light':'dark');hubNode('themeIcon').textContent=light?'🌙':'☀️';hubNode('themeLabel').textContent=light?'Dark':'Light';hubNode('themeToggle').setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');
}
document.addEventListener('keydown',event=>{
  if(syncGateIsolation()){trapHubFocus(event,hubNode('pwGate'));return}
  if(hubDialog){if(event.key==='Escape'){event.preventDefault();closeHubDialog()}else trapHubFocus(event,hubDialog);return}
  const box=hubNode('hubResults'),input=hubNode('hubSearch');if(!box.classList.contains('show'))return;
  if(event.key==='Escape'&&(event.target===input||box.contains(event.target))){event.preventDefault();closeHubSearch();input.focus();return}
  const results=[...box.querySelectorAll('a,button')],index=results.indexOf(document.activeElement);
  if(event.key==='ArrowDown'&&(event.target===input||box.contains(event.target))){event.preventDefault();results[Math.min(index+1,results.length-1)]?.focus()}
  if(event.key==='ArrowUp'&&box.contains(event.target)){event.preventDefault();if(index<=0)input.focus();else results[index-1].focus()}
  if(event.key==='Enter'&&event.target===input&&results[0]){event.preventDefault();results[0].click()}
});
document.addEventListener('click',event=>{if(!document.querySelector('.search-wrap').contains(event.target))closeHubSearch()});
window.addEventListener('storage',event=>{if(event.key===null||event.key==='studyTheme')hubThemeSession=null;if(event.key===null||SYNC_KEYS.includes(event.key)||event.key===HUB_BACKUP_KEY)refreshHub()});
window.addEventListener('focus',refreshHub);window.addEventListener('pageshow',refreshHub);
let hubPrintDetails=[];
window.addEventListener('beforeprint',()=>{hubPrintDetails=[...document.querySelectorAll('main details')].map(el=>[el,el.open]);hubPrintDetails.forEach(([el])=>el.open=true)});
window.addEventListener('afterprint',()=>{hubPrintDetails.forEach(([el,open])=>el.open=open);hubPrintDetails=[]});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHub()});
setInterval(()=>{if(!document.hidden&&!hubDialog){renderPickupPanel();renderWeakSpots()}},60000);
const originalHubUnlock=checkPw;checkPw=function(){originalHubUnlock();if(!syncGateIsolation())hubNode('mainContent').focus()};
const originalHubTheme=toggleTheme;toggleTheme=function(){originalHubTheme();hubThemeSession=document.documentElement.getAttribute('data-theme')==='light'?'light':'dark';refreshHub()};
refreshHub();if(syncGateIsolation())hubNode('pwInput').focus();
