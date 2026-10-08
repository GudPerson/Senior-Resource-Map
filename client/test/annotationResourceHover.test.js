import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationActivationKey, beginAnnotationActivation, endAnnotationActivation,
    bindAnnotationHoverElement, isAnnotationTouchEvent } from '../src/lib/annotationResourceHover.js';
import { buildAnnotationLinkIndex, buildAnnotationResourceEffects } from '../src/lib/annotationResourceLinks.js';

const link={type:'hard',id:1};
const slot=(origin,channel,version,identity='a')=>{const next={origin,channel,activationVersion:version,
    ...(origin==='annotation'?{annotationId:identity}:{resourceLinks:[link]})};return{...next,key:annotationActivationKey(next)};};

test('pointer leave removes only its matching token and preserves keyboard focus and a newer origin',()=>{
    const focus=slot('annotation','focus',1), pointer=slot('resources','pointer',2);
    let slots=beginAnnotationActivation([focus],pointer);
    assert.equal(slots.at(-1),pointer);
    slots=endAnnotationActivation(slots,pointer.key,2);
    assert.deepEqual(slots,[focus]);
    const reentry=slot('resources','pointer',3);
    slots=beginAnnotationActivation(beginAnnotationActivation(slots,pointer),reentry);
    slots=endAnnotationActivation(slots,pointer.key,2);
    assert.equal(slots.at(-1),reentry,'Late leave cannot clear a newly entered hover of the same resource.');
    const annotation=slot('annotation','pointer',4,'b');
    slots=beginAnnotationActivation(slots,annotation);
    slots=endAnnotationActivation(slots,reentry.key,3);
    assert.equal(slots.at(-1),annotation);
    assert.deepEqual(endAnnotationActivation(slots,annotation.key,4),[focus]);
});

test('all three behaviours follow hover entry/exit without mutating annotations or revealing a hidden view',()=>{
    const annotations=[{id:'a',resourceLinks:[link],resourceBehaviour:'appear'},
        {id:'p',resourceLinks:[link],resourceBehaviour:'pulse'},
        {id:'h',resourceLinks:[link],resourceBehaviour:'highlight',resourceGlowColor:'#123456'}];
    const before=structuredClone(annotations),catalog=[{key:'hard:1',link}];
    const index=buildAnnotationLinkIndex(annotations,catalog);
    const idle=buildAnnotationResourceEffects({annotations,index});
    assert.deepEqual([...idle.visibleIds],['p','h']);
    const selection=slot('resources','pointer',1);
    const active=buildAnnotationResourceEffects({annotations,index,selection,pulseActive:true});
    assert.deepEqual([...active.activeIds],['a','p','h']);
    assert.deepEqual([...active.pulseIds],['p']);
    assert.equal(active.annotationGlowColors.get('h'),'#123456');
    assert.equal(buildAnnotationResourceEffects({annotations,index,selection,pulseActive:true,reducedMotion:true}).pulseIds.size,0);
    assert.equal(buildAnnotationResourceEffects({annotations,index,selection,enabled:false}).activeIds.size,0);
    const hidden=buildAnnotationLinkIndex(annotations,catalog,[]);
    assert.equal(buildAnnotationResourceEffects({annotations,index:hidden,selection,visibleAnnotationIds:[]}).visibleIds.size,0);
    assert.deepEqual(annotations,before);
});

function element(){const attrs=new Map([['tabindex','-1']]), handlers=new Map();return{attrs,handlers,
    getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name),
    addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);},
    dispatch:(name,value={})=>handlers.get(name)?.(value)};}

test('actual Leaflet DOM adapter supports hover, focus, touch fallback and complete cleanup',()=>{
    const el=element(),entered=[],left=[];
    const binding=bindAnnotationHoverElement(el,{label:'Fictional annotation',onActivate:channel=>{entered.push(channel);return entered.length;},onDeactivate:(channel,token)=>left.push([channel,token])});
    assert.equal(el.attrs.get('tabindex'),'0');assert.equal(el.attrs.get('aria-label'),'Fictional annotation');
    el.dispatch('focus');el.dispatch('pointerenter',{pointerType:'mouse'});el.dispatch('pointerleave');
    assert.deepEqual(entered,['focus','pointer']);assert.deepEqual(left,[['pointer',2]]);
    el.dispatch('pointerdown',{pointerType:'mouse'});el.dispatch('focus');el.dispatch('pointerup');
    binding.activateTouch({pointerType:'mouse'});assert.equal(entered.length,2);
    el.dispatch('pointerdown',{pointerType:'mouse'});el.dispatch('pointerleave');el.dispatch('focus');
    assert.equal(entered.at(-1),'focus','A drag released outside the annotation cannot suppress keyboard focus.');
    el.dispatch('blur');
    el.dispatch('pointerenter',{pointerType:'touch'});el.dispatch('pointerdown',{pointerType:'touch'});el.dispatch('focus');
    binding.activateTouch({originalEvent:{type:'click'}});el.dispatch('pointerup');
    assert.deepEqual(entered,['focus','pointer','focus','touch']);
    binding.cleanup();assert.deepEqual(left,[['pointer',2],['focus',3],['touch',4]]);
    assert.equal(el.handlers.size,0);assert.equal(el.attrs.get('tabindex'),'-1');assert.equal(el.attrs.has('aria-label'),false);
});

test('touch detection handles Leaflet and browser event wrappers without treating a mouse click as touch',()=>{
    assert.equal(isAnnotationTouchEvent({originalEvent:{pointerType:'touch'}}),true);
    assert.equal(isAnnotationTouchEvent({nativeEvent:{sourceCapabilities:{firesTouchEvents:true}}}),true);
    assert.equal(isAnnotationTouchEvent({nativeEvent:{pointerType:'mouse'}}),false);
    assert.equal(isAnnotationTouchEvent({originalEvent:{type:'keydown',key:'Enter'}},'touch'),false);
    assert.equal(isAnnotationTouchEvent({nativeEvent:{type:'click',detail:0,pointerType:''}},'touch'),false);
});
