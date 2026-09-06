/* Navigation-only enhancement; no teaching records or persisted learner state change. */
'use strict';
function applyHubNavigation(){
  const params=new URLSearchParams(window.location.search);
  const number=params.get('exam'),exam=/^[1-4]$/.test(number||'')?'Exam '+number:null;
  if(number&&!exam)return;
  const file=decodeURIComponent(window.location.pathname).split('/').pop();
  if(file==='NUR2460Flashcards.html'){
    const mode=params.get('mode'),group=params.get('group');
    const groups=exam?Object.keys(EXAMS[exam]):Object.keys(EXAMS).flatMap(name=>Object.keys(EXAMS[name]));
    const selected=group&&groups.includes(group)?[group]:groups;
    const validGroup=!!group&&groups.includes(group);
    if(!exam&&!validGroup&&!['due','review','study'].includes(mode))return;
    // Persistence restores before this script runs. Never let a hub route silently
    // replace an unfinished queue; restarting is an explicit, recoverable action.
    const savedSession=window.flashcardsAnki?.captureSession?.();
    const resumeSaved=!!savedSession&&savedSession.position<savedSession.queue.length&&params.get('restart')!=='1';
    if(resumeSaved){
      switchMode('study');
    }else{
      selectedTopics=new Set(selected);
      buildSidebar();
      document.querySelectorAll('.sb-section').forEach(section=>{const label=section.querySelector('.sb-section-label');if(exam&&label?.textContent.includes(exam))section.classList.remove('collapsed')});
      document.getElementById('gridExamFilter').value=exam||'all';
      document.getElementById('gridTopicFilter').value=validGroup?group:'all';
      if(mode==='due'||mode==='review'||mode==='study'||validGroup){
        dueOnly=mode==='due';starFilterOn=false;
        document.getElementById('dueFilter').classList.toggle('active',dueOnly);
        document.getElementById('starFilter').classList.remove('active');
        switchMode('study');startRound();
      }else if(mode==='focus'){switchMode('focus')}else{switchMode('grid')}
    }
    const requested=[exam||'All exams',validGroup?group:null,mode==='due'?'Due-only review':mode==='review'||mode==='study'||validGroup?'Review':'Browse'].filter(Boolean).join(' · ');
    const remaining=resumeSaved?savedSession.queue.length-savedSession.position:0;
    const context=resumeSaved?'Resumed saved session · '+remaining+(remaining===1?' card remaining':' cards remaining'):requested;
    let banner=document.getElementById('hubRouteContext');
    if(!banner){banner=document.createElement('section');banner.id='hubRouteContext';banner.setAttribute('aria-label','Opened from study hub');banner.style.cssText='margin:12px 0;padding:12px 16px;border:1px solid var(--border);border-radius:10px;font-size:16px;color:var(--text);background:var(--surface);';const target=document.getElementById('gridView');target.parentElement.insertBefore(banner,target)}
    banner.replaceChildren();const label=document.createElement('strong');label.textContent=context;banner.appendChild(label);
    if(resumeSaved){const restart=document.createElement('a');const restartParams=new URLSearchParams(params);restartParams.set('restart','1');restart.href='NUR2460Flashcards.html?'+restartParams.toString();restart.textContent='Start the requested deck instead';restart.style.cssText='display:inline-block;margin-left:16px;color:var(--accent);text-decoration:underline;';banner.appendChild(restart)}
    const back=document.createElement('a');back.href='index.html#courseMapTitle';back.textContent='Back to course map';back.style.cssText='display:inline-block;margin-left:16px;color:var(--accent);text-decoration:underline;';banner.appendChild(back);
    const reset=document.createElement('a');reset.href='NUR2460Flashcards.html';reset.textContent='Browse all exams';reset.style.cssText='display:inline-block;margin-left:16px;color:var(--accent);text-decoration:underline;';banner.appendChild(reset);
    if(!resumeSaved&&mode==='due'&&!deck.length){const empty=document.createElement('p');empty.textContent='No active cards are due in this scope. Nothing was added to your review history.';banner.appendChild(empty)}
  }
  if(file==='NUR2460Pharmacology.html'){
    if(params.get('drug')||window.location.hash.startsWith('#drug='))return;
    const legacy={'#exam1pharm':'Exam 1','#exam2pharm':'Exam 2','#exam3acc':'Exam 3','#exam4acc':'Exam 4'};
    const targetExam=exam||legacy[window.location.hash];if(!targetExam)return;
    const categoryIds=PHARM_EXAM_CATS[targetExam];if(!categoryIds)return;
    const first=document.getElementById(categoryIds[0]),section=first?.closest('.exam-accordion');if(!section)return;
    section.classList.remove('collapsed');categoryIds.forEach(id=>{const category=document.getElementById(id);category?.classList.remove('collapsed');category?.querySelector('.pharm-cat-header')?.setAttribute('aria-expanded','true')});
    const header=section.querySelector('.exam-header');
    header.setAttribute('role','button');header.setAttribute('tabindex','0');header.setAttribute('aria-expanded','true');header.setAttribute('aria-label',targetExam+' medication section');
    if(!header.dataset.hubKeyboard){header.dataset.hubKeyboard='true';if(!header.dataset.previewKeyboard)header.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();header.click()}});header.addEventListener('click',()=>header.setAttribute('aria-expanded',String(!section.classList.contains('collapsed'))))}
    header.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:'auto'});
  }
}
applyHubNavigation();
if(decodeURIComponent(window.location.pathname).endsWith('/NUR2460Pharmacology.html'))window.addEventListener('hashchange',applyHubNavigation);
