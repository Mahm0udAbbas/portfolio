import { site } from "@/content/site";
import { Section } from "@/components/ui/section";
import { SkillsStage } from "@/components/skills/skills-stage";

/** Skills: a physics pile of 3D keycaps (Blender → R3F + Rapier). */
export function Skills() {
  return (
    <Section id="skills" label="skills">
      <h2 data-reveal className="mb-4 text-4xl font-semibold tracking-tight sm:text-6xl">
        My stack<span className="text-accent">.</span>
      </h2>
      <p data-reveal className="mb-6 max-w-xl text-lg text-fg/70">
        The tools I reach for every day. Go ahead, throw them around.
      </p>
      <SkillsStage groups={site.skills} />
    </Section>
  );
}
