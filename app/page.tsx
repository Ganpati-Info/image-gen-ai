"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Stage = "idle" | "analyzing" | "generating" | "complete" | "error";

export default function Home() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState("");
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [generated, setGenerated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = stage === "analyzing" || stage === "generating";

  useEffect(() => {
    return () => { if (image?.startsWith("blob:")) URL.revokeObjectURL(image); };
  }, [image]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image.");
    if (file.size > 10 * 1024 * 1024) return alert("Image must be smaller than 10 MB.");
    if (image?.startsWith("blob:")) URL.revokeObjectURL(image);
    setImage(URL.createObjectURL(file));
    setSelectedFile(file);
    setGeneratedImage(null);
    setAiContext("");
    setFileName(file.name);
    setGenerated(false);
    setStage("idle");
  }

  function removeImage() {
    if (image?.startsWith("blob:")) URL.revokeObjectURL(image);
    setImage(null); setSelectedFile(null); setGeneratedImage(null); setAiContext(""); setFileName(""); setGenerated(false); setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function generate() {
    if (!title.trim()) return alert("Enter a title first.")
    if (!description.trim()) return alert("Describe the issue first.")
    if (!selectedFile) return alert("Upload a current-condition image first.")

    try {
      setStage("analyzing")
      setGenerated(false)
      setGeneratedImage(null)
      setAiContext("")

      const formData = new FormData()
      formData.append("title", title)
      formData.append("description", description)
      formData.append("image", selectedFile)

      const response = await fetch("/api/generate-reference", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "AI generation failed.")

      setStage("generating")
      setAiContext(data.context)
      setGeneratedImage(data.generatedImage)
      setGenerated(true)
      setStage("complete")
    } catch (error) {
      console.error(error)
      setStage("error")
      alert(error instanceof Error ? error.message : "AI generation failed.")
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-9 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f47216] text-white font-bold">E</div>
            <div>
              <p className="text-sm font-bold text-[#172033]">ESIC</p>
              <p className="text-xs text-[#667085]">AI Repair Reference</p>
            </div>
          </div>
          <span className="rounded-full border border-[#dfe3e8] bg-white px-3 py-1.5 text-xs font-medium text-[#667085]">Prototype</span>
        </header>

        <div className="mb-9 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#356ca5]">New grievance</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Show us the problem.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">Upload the current condition. AI will use your description and the photograph to create a visual reference for the expected repaired condition.</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_350px]">
          <div className="rounded-2xl border border-[#e1e5ea] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04)] sm:p-8">
            <div className="mb-7 border-b border-[#eef0f2] pb-5">
              <h2 className="text-lg font-semibold">Grievance details</h2>
              <p className="mt-1 text-sm text-[#667085]">Give the AI enough context to understand what needs to change.</p>
            </div>

            <div className="space-y-6">
              <Field label="Title">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Damaged door and windows in hospital room" className="input" />
              </Field>

              <Field label="Description">
                <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={7} placeholder="Describe the current condition and what you want repaired or replaced..." className="input resize-none leading-6" />
                <div className="mt-2 flex justify-between text-xs text-[#98a2b3]"><span>Describe the damage and requested repair.</span><span>{description.length}/2000</span></div>
              </Field>

              <Field label="Current condition image" hint="Required for this prototype">
                {!image ? (
                  <label className="group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d6dae0] bg-[#fafbfc] px-6 text-center transition hover:border-[#4779aa] hover:bg-[#f8fafc]">
                    <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#edf4fb] text-[#356ca5]">
                      <UploadIcon />
                    </div>
                    <p className="text-sm font-semibold">Drop an image here</p>
                    <p className="mt-1 text-xs text-[#98a2b3]">or click to browse. JPG, PNG or WEBP, up to 10 MB</p>
                    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" />
                  </label>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e1e5ea]">
                    <div className="relative aspect-[16/10] bg-[#eef0f2]">
                      <img src={image} alt="Current condition" className="h-full w-full object-cover" />
                      <button type="button" onClick={removeImage} className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-[#b42318] shadow">Remove</button>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{fileName}</p><p className="text-xs text-[#98a2b3]">Current condition</p></div>
                      <span className="shrink-0 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#027a48]">Ready</span>
                    </div>
                  </div>
                )}
              </Field>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-[#e1e5ea] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04)] lg:sticky lg:top-6">
            <div className="mb-6 flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf4fb] text-[#356ca5]"><SparkIcon /></div>
              <div><h2 className="font-semibold">AI reference</h2><p className="mt-1 text-xs leading-5 text-[#667085]">A preview of how the space may look after repair.</p></div>
            </div>

            <div className="space-y-3">
              <Step n="01" title="Analyze" text="Read the description and inspect visible damage." active={stage === "analyzing"} done={stage === "generating" || stage === "complete"} />
              <Step n="02" title="Build context" text="Combine text and visual information." active={stage === "generating"} done={stage === "complete"} />
              <Step n="03" title="Generate" text="Create the repaired-condition reference." active={stage === "generating"} done={stage === "complete"} />
            </div>

            <button onClick={generate} disabled={busy} className="mt-6 w-full rounded-xl bg-[#f47216] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0e3156] disabled:cursor-not-allowed disabled:opacity-60">
              {stage === "analyzing" ? "Analyzing image..." : stage === "generating" ? "Generating reference..." : generated ? "Generate again" : "Generate AI reference"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-4 text-[#98a2b3]">This is a visual reference. It does not confirm that repair has been completed.</p>
          </aside>
        </section>

        {generated && image && (
          <section className="mt-6 rounded-2xl border border-[#e1e5ea] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04)] sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#027a48]">Generated</span><span className="text-xs text-[#98a2b3]">AI visual reference</span></div><h2 className="text-xl font-semibold">Expected repaired condition</h2></div>
              <button onClick={generate} className="rounded-lg border border-[#d6dae0] bg-white px-4 py-2 text-xs font-semibold text-[#344054]">Regenerate</button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Preview label="Current condition" src={image} />
              <GeneratedPreview src={generatedImage} />
            </div>

            <div className="mt-6 rounded-xl bg-[#f7f9fb] p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">AI-generated context</p>
              <p className="text-sm leading-6 text-[#475467]">{aiContext || "AI context will appear here after generation."}</p>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{` .input { width:100%; border:1px solid #d6dae0; border-radius:12px; background:#fff; padding:13px 15px; font-size:14px; outline:none; transition:.15s; } .input:focus { border-color:#4779aa; box-shadow:0 0 0 4px rgba(53,108,165,.10); } .input::placeholder { color:#98a2b3; } `}</style>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-[#344054]">{label}</label>{hint && <span className="text-xs text-[#98a2b3]">{hint}</span>}</div>{children}</div>; }

function Step({ n, title, text, active, done }: { n:string; title:string; text:string; active:boolean; done:boolean }) { return <div className="flex gap-3 rounded-xl border border-[#edf0f2] p-3"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${done ? "bg-[#ecfdf3] text-[#027a48]" : active ? "bg-[#edf4fb] text-[#356ca5]" : "bg-[#f2f4f7] text-[#667085]"}`}>{done ? "✓" : n}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-[#98a2b3]">{text}</p></div></div>; }

function Preview({ label, src }: { label:string; src:string }) { return <div><div className="mb-2 text-sm font-semibold text-[#344054]">{label}</div><div className="aspect-[16/10] overflow-hidden rounded-xl border border-[#e1e5ea] bg-[#eef0f2]"><img src={src} alt={label} className="h-full w-full object-cover" /></div></div>; }

function GeneratedPreview({ src }: { src: string | null }) { return <div><div className="mb-2 flex items-center justify-between"><div className="text-sm font-semibold text-[#344054]">AI-generated reference</div><span className="rounded-full bg-[#edf4fb] px-2 py-1 text-[10px] font-bold text-[#356ca5]">AI</span></div><div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[#cbd9e6] bg-[#eaf0f5]">{src ? <img src={src} alt="AI-generated repaired condition reference" className="h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><SparkIcon /></div><p className="text-sm font-semibold text-[#344054]">Generating...</p></div></div>}</div></div>; }

function UploadIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/></svg>; }
function SparkIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></svg>; }
