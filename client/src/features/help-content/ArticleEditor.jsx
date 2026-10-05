import { useId, useRef } from 'react';
import { CMS_LIMITS, cmsHasSeparateAnswers, reorderCmsItems } from '../../../../shared/helpContentCms.js';
import { CmsButton, CmsField, CmsOrderButtons } from './CmsControls.jsx';
import { cmsAddStep, cmsMoveMedia, cmsMoveStep, cmsNewSection, cmsUpdateMedia } from './helpContentDraftModel.js';

function TextList({ label, values, update, lockedLength = false }) {
    return <div><h3>{label}</h3>{values.map((value, index) => <CmsField key={index} label={`${label} ${index + 1}`} multiline value={value} onChange={(text) => update(values.map((item, i) => i === index ? text : item))} maxLength={16000} />)}
        <div className="cms-media-actions">{!lockedLength && <CmsButton disabled={values.length >= 60} onClick={() => update([...values, ''])}>Add {label === 'Notes' ? 'note' : 'paragraph'}</CmsButton>}{!lockedLength && values.length > 0 && <CmsButton danger onClick={() => update(values.slice(0, -1))}>Remove last {label === 'Notes' ? 'note' : 'paragraph'}</CmsButton>}</div>
        {lockedLength && <p className="cms-muted">Each paragraph supplies one existing Guide answer. Keep these paragraphs in place and add numbered instructions below when needed.</p>}
    </div>;
}
function AttachmentEditor({ item, section, index, siblings, update, mediaUrls }) {
    const target = item.afterStepId === null ? 'introduction' : `instruction ${section.stepIds.indexOf(item.afterStepId) + 1}`;
    const field = (key, value) => update(cmsUpdateMedia(section, item.id, key, value));
    return <div className="cms-attachment" data-media-id={item.id}>
        <div className="cms-step-head"><strong style={{ fontSize: 12 }}>{item.type === 'image' ? 'Image' : 'Video link'} {index + 1}</strong><CmsOrderButtons label={`${item.type} ${index + 1} for ${target}`} first={index === 0} last={index === siblings.length - 1} onMove={(direction) => update(cmsMoveMedia(section, item.id, direction))} /></div>
        {item.type === 'image' && mediaUrls[item.assetId] && <img src={mediaUrls[item.assetId]} alt={item.alt || 'Uploaded image awaiting an accessible description'} style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', marginTop: 10 }} />}
        <CmsField label="Caption" value={item.caption} onChange={(value) => field('caption', value)} maxLength={1000} />
        {item.type === 'image' ? <CmsField label="Accessible description" value={item.alt} onChange={(value) => field('alt', value)} hint="Describe the control or information this image shows." maxLength={1000} /> : <>
            <CmsField label="Video link" value={item.url} onChange={(value) => field('url', value)} type="url" placeholder="https://www.youtube.com/watch?v=…" hint="Use a specific YouTube or Vimeo video. Playback opens only when the reader chooses it." maxLength={2000} />
            <CmsField label="Written transcript" value={item.transcript} onChange={(value) => field('transcript', value)} multiline maxLength={16000} />
            <label className="cms-field" style={{ flexDirection: 'row', alignItems: 'start' }}><input type="checkbox" checked={item.transcriptReviewed === true} onChange={(event) => field('transcriptReviewed', event.target.checked)} style={{ width: 18, minHeight: 18, marginTop: 3 }} /><span>I checked that this transcript agrees with the written instructions.</span></label>
        </>}
        <CmsField label="Placement"><select value={item.afterStepId ?? 'introduction'} onChange={(event) => field('afterStepId', event.target.value === 'introduction' ? null : event.target.value)}><option value="introduction">In the introduction</option>{section.stepIds.map((id, i) => <option key={id} value={id}>After instruction {i + 1}</option>)}</select></CmsField>
        <CmsButton danger onClick={() => update({ ...section, media: section.media.filter((value) => value.id !== item.id) })}>Remove attachment</CmsButton>
    </div>;
}
export function AttachmentGroup({ article, section, afterStepId, update, onUpload, mediaUrls, uploadBusy, allowImageUpload, compact = false }) {
    const input = useRef(null), inputId = useId();
    const items = section.media.filter((item) => item.afterStepId === afterStepId);
    const all = article.sections.flatMap((item) => item.media || []);
    const allowed = article.visibility === 'public';
    function addVideo() {
        const used = new Set(section.media.map((item) => item.id)); let index = 1;
        while (used.has(`media-${index}`)) index += 1;
        update({ ...section, media: [...section.media, { id: `media-${index}`, type: 'video', afterStepId, caption: '', url: '', transcript: '', transcriptReviewed: false }] });
    }
    if (!allowed) return <p className="cms-muted">Attachments are available for public articles.</p>;
    return <div>
        <div className="cms-media-actions">
            <CmsButton disabled={uploadBusy || !allowImageUpload || all.length >= 24 || all.filter((item) => item.type === 'image').length >= 12} onClick={() => input.current?.click()}>Add images</CmsButton>
            <CmsButton disabled={all.length >= 24 || all.filter((item) => item.type === 'video').length >= 12} onClick={addVideo}>Add video link</CmsButton>
            <span className="cms-muted">{items.length} {items.length === 1 ? 'attachment' : 'attachments'}</span>
        </div>
        <input ref={input} id={inputId} type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label={`Upload images ${afterStepId ? 'after this instruction' : 'in the introduction'}`} style={{ display: 'none' }} onChange={(event) => { const files = Array.from(event.target.files); event.target.value = ''; onUpload(section.id, afterStepId, files); }} />
        {!allowImageUpload && <p className="cms-muted">Save this new article before uploading images.</p>}
        {items.map((item, index) => compact ? <details key={item.id} className="cms-context-attachment"><summary>{item.type === 'image' ? 'Image' : 'Video link'} {index + 1} · {item.caption || 'Add a caption and details'}</summary><AttachmentEditor item={item} section={section} index={index} siblings={items} update={update} mediaUrls={mediaUrls} /></details> : <AttachmentEditor key={item.id} item={item} section={section} index={index} siblings={items} update={update} mediaUrls={mediaUrls} />)}
    </div>;
}
function SectionEditor({ article, section, index, update, onMove, onRemove, onRemoveStep, onUpload, mediaUrls, uploadBusy, allowImageUpload }) {
    const separateAnswers = cmsHasSeparateAnswers(section);
    return <section className="cms-section" aria-label={`Edit section ${index + 1}`}>
        <div className="cms-step-head"><h2>Section {index + 1}</h2><CmsOrderButtons label={`section ${index + 1}`} first={index === 0} last={index === article.sections.length - 1} onMove={onMove} /></div>
        <CmsField label="Section title" value={section.title} onChange={(title) => update({ ...section, title })} maxLength={240} />
        <TextList label="Introduction" values={section.paragraphs} update={(paragraphs) => update({ ...section, paragraphs })} lockedLength={separateAnswers} />
        <AttachmentGroup article={article} section={section} afterStepId={null} update={update} onUpload={onUpload} mediaUrls={mediaUrls} uploadBusy={uploadBusy} allowImageUpload={allowImageUpload} />
        <h3 style={{ marginTop: 24 }}>Numbered instructions</h3>
        {section.steps.map((text, i) => <div className="cms-step" key={section.stepIds[i]} data-step-id={section.stepIds[i]}>
            <div className="cms-step-head"><strong>Instruction {i + 1}</strong><CmsOrderButtons label={`instruction ${i + 1} in section ${index + 1}`} first={i === 0} last={i === section.steps.length - 1} onMove={(direction) => update(cmsMoveStep(section, section.stepIds[i], direction))} /></div>
            <CmsField label={`Instruction ${i + 1} text`} value={text} multiline onChange={(value) => update({ ...section, steps: section.steps.map((step, stepIndex) => stepIndex === i ? value : step) })} maxLength={16000} />
            <AttachmentGroup article={article} section={section} afterStepId={section.stepIds[i]} update={update} onUpload={onUpload} mediaUrls={mediaUrls} uploadBusy={uploadBusy} allowImageUpload={allowImageUpload} />
            <CmsButton danger onClick={() => onRemoveStep(section.id, section.stepIds[i])}>Remove instruction</CmsButton>
        </div>)}
        <div className="cms-media-actions"><CmsButton disabled={section.steps.length >= CMS_LIMITS.steps} onClick={() => update(cmsAddStep(section))}>Add instruction</CmsButton></div>
        <TextList label="Notes" values={section.notes} update={(notes) => update({ ...section, notes })} />
        <CmsButton danger disabled={article.sections.length === 1 || section.facts.length > 0} onClick={onRemove}>Remove section</CmsButton>
        {section.facts.length > 0 && <p className="cms-muted" style={{ marginTop: 8 }}>This section supplies existing Guide answers. Its identity is retained when you edit.</p>}
    </section>;
}
export default function ArticleEditor({ article, categories, onChange, onRemoveStep, onUpload, mediaUrls = {}, uploadBusy = false, allowImageUpload = true }) {
    const updateSection = (id, section) => onChange({ ...article, sections: article.sections.map((value) => value.id === id ? section : value) });
    return <div>
        <CmsField label="Article title" value={article.title} onChange={(title) => onChange({ ...article, title })} maxLength={240} />
        <CmsField label="Summary" value={article.summary} onChange={(summary) => onChange({ ...article, summary })} multiline maxLength={1000} />
        <CmsField label="Topic"><select value={article.category} onChange={(event) => onChange({ ...article, category: event.target.value })}>{categories.filter((category) => !category.archived || category.id === article.category).map((category) => <option key={category.id} value={category.id}>{category.title}{category.archived ? ' (archived)' : ''}</option>)}</select></CmsField>
        <p className="cms-muted">{article.visibility === 'public' ? 'Public article' : 'Account access required'} · /help-centre/{article.slug}</p>
        {article.sections.map((section, index) => <SectionEditor key={section.id} article={article} section={section} index={index} update={(value) => updateSection(section.id, value)} onMove={(direction) => onChange({ ...article, sections: reorderCmsItems(article.sections, section.id, direction) })} onRemove={() => onChange({ ...article, sections: article.sections.filter((value) => value.id !== section.id) })} onRemoveStep={onRemoveStep} onUpload={onUpload} mediaUrls={mediaUrls} uploadBusy={uploadBusy} allowImageUpload={allowImageUpload} />)}
        <CmsButton disabled={article.sections.length >= CMS_LIMITS.sections} onClick={() => onChange({ ...article, sections: [...article.sections, cmsNewSection(article)] })}>Add section</CmsButton>
    </div>;
}
