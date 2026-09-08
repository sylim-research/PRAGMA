import type { WeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";

/** 같은 공용 본문을 유인물·프로젝터·HTML에서 공유한다. 교수자 메모는 받지 않는다. */
export function WeeklyMaterialDocument({ material, activeSection }: {
  material: WeeklyCourseMaterial;
  activeSection?: number;
}) {
  return (
    <article className="weekly-material min-w-0 space-y-5 [overflow-wrap:anywhere]" aria-label={`${material.weekNo}주차 강의 유인물`}>
      <header className="material-heading rounded-xl bg-[#FAD338] px-6 py-5 text-[#15202B] print:rounded-none">
        <p className="text-xs font-semibold">{material.courseTitle} · {material.weekNo}주차</p>
        <h1 className="mt-2 text-2xl font-bold">{material.title}</h1>
        <p className="mt-2 text-sm">{material.contextLabel}</p>
        <p className="mt-3 text-sm font-semibold">{material.preparationLabel}</p>
        <p className="material-preparation-note mt-1 text-xs leading-5">{material.preparationNote}</p>
      </header>
      {material.sections.map((section, index) => (
        <section
          key={section.id}
          data-material-section={index}
          hidden={activeSection !== undefined && index !== activeSection}
          className="material-section break-inside-avoid rounded-xl border border-[#E5DFD0] bg-white p-6 print:rounded-none"
        >
          <h2 className="text-lg font-bold">{section.title}</h2>
          {section.paragraphs.map((paragraph, i) => <p key={i} className="mt-3 text-sm leading-7">{paragraph}</p>)}
          {section.items.length > 0 && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
            {section.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>}
        </section>
      ))}
    </article>
  );
}
