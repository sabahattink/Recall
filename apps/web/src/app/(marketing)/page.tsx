import { HeroSection } from '@/components/marketing/hero-section';
import { ProblemSection } from '@/components/marketing/problem-section';
import { OutputSection } from '@/components/marketing/output-section';
import { HowRecallWorksSection } from '@/components/marketing/how-recall-works-section';
import { AssistantsSection } from '@/components/marketing/assistants-section';
import { ComparisonSection } from '@/components/marketing/comparison-section';
import { GuaranteesSection } from '@/components/marketing/guarantees-section';
import { MemoryExcerptSection } from '@/components/marketing/memory-excerpt-section';
import { ClosingSection } from '@/components/marketing/closing-section';

/**
 * The landing page, read top to bottom once: the claim and the command,
 * the problem, what is written, how, who reads it, how it sits next to
 * hand-written files, what is guaranteed, the evidence, and the command
 * again. Fully static — the only client code is the copy buttons.
 */
export default function MarketingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <OutputSection />
      <HowRecallWorksSection />
      <AssistantsSection />
      <ComparisonSection />
      <GuaranteesSection />
      <MemoryExcerptSection />
      <ClosingSection />
    </>
  );
}
