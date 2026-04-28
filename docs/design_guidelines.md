# Design Guidelines for Intelligent Assessments Page - EIAPH

## Design Approach
**Enhanced System-Based**: Material Design foundation elevated with premium consulting aesthetics. This assessment platform balances government-grade trustworthiness with cutting-edge AI sophistication—think McKinsey Digital meets Google AI, where strategic intelligence commands respect through refined, futuristic design.

## Core Design Elements

### A. Typography
- **Primary**: Inter (Google Fonts) - maintains platform consistency
- **Display**: Inter 700-800 weight (48-72px) for assessment titles and hero headlines
- **Headings**: Inter 600-700 (24-36px) for section headers and feature titles
- **Body**: Inter 400-500 (16-18px) for descriptions and analysis text
- **Data/Metrics**: Inter 600 (32-48px) for maturity scores and KPIs
- **Technical**: JetBrains Mono for AI model parameters and technical specifications

### B. Layout System
**Tailwind Spacing**: Primary units 4, 6, 8, 12, 16, 20, 24 for sophisticated rhythm
- Hero section: py-20 to py-24, generous breathing room
- Content sections: py-16 to py-20 with max-w-7xl containers
- Cards: p-8 with gap-6 between elements for premium feel
- Component spacing: mb-12 to mb-16 between major sections

### C. Component Library

**Hero Section:**
- Full-width gradient background (violet to indigo radial)
- Centered headline + subheadline + dual CTAs
- Floating assessment preview card showcasing AI analysis
- Subtle particle animation or grid overlay for tech sophistication
- Height: 85vh for impact without forcing 100vh

**Assessment Feature Grid:**
- 3-column layout (lg:grid-cols-3) showcasing assessment types
- Each card: icon + title + description + "Begin Assessment" CTA
- Gradient borders (violet/indigo) on hover
- Maturity level indicators with progress visualization
- Stack to single column on mobile

**AI Analysis Showcase:**
- 2-column split: Left (visual dashboard preview), Right (capability list)
- Animated metric counters showing assessment insights
- Tech-forward iconography (neural networks, analytics charts)
- Gold accent highlights for premium AI features

**Maturity Framework Section:**
- Horizontal timeline or stepped progression visual
- 5 maturity levels displayed as connected stages
- Each stage: icon + level name + brief descriptor
- Subtle glow effects on hover with indigo/violet treatment

**Assessment Process:**
- 4-column grid showing workflow steps (lg:grid-cols-4)
- Numbered sequence: Assess → Analyze → Strategize → Transform
- Connecting lines between steps with subtle animation
- Icon + title + short description per step

**Trust & Credibility:**
- Government partner logos in tasteful grid
- Statistical proof points (3-4 metrics in horizontal layout)
- Testimonial card from senior government official
- Security certification badges with gold accents

**CTA Section:**
- Centered layout with gradient background
- Primary CTA: "Schedule Strategic Assessment"
- Secondary option: "Download Framework Overview"
- Supporting text emphasizing confidential, secure process

### D. Visual Elements & Animations

**Gradients:**
- Hero background: Radial violet (280deg 60% 25%) to indigo (240deg 50% 20%)
- Card overlays: Subtle linear gradients with 5% opacity shifts
- CTA buttons: Gold (45deg 85% 55%) to amber (35deg 90% 50%)
- Section dividers: Indigo to transparent fades

**Subtle Animations:**
- Hero elements: Gentle fade-up on load (0.5s ease-out)
- Assessment cards: Scale up 1.02 on hover with shadow expansion
- Metric counters: Count-up animation when scrolling into view
- Timeline stages: Progressive reveal on scroll
- Particle effects: Slow-moving background elements (if technically feasible)

**Shadows & Depth:**
- Cards: shadow-lg with indigo tint on hover
- Floating elements: shadow-xl with blur
- Buttons: subtle glow effect using box-shadow in brand colors

### E. Government-Premium Fusion

**Professional Trust Signals:**
- High contrast text (AA+ compliance)
- Secure data badging with lock icons
- Confidentiality statements in footers
- Government seal placements

**Premium Consulting Aesthetic:**
- Generous whitespace between sections
- Sophisticated color transitions
- Premium iconography (Heroicons with custom sizing)
- Executive-level language and positioning
- Gold accents used sparingly for emphasis

## Images

**Hero Image Requirements:**
- Large hero background: Abstract visualization of interconnected data nodes, neural networks, or strategic planning interfaces
- Style: Dark, sophisticated, slightly blurred/frosted with violet/indigo overlay
- Placement: Full-width behind hero content, 85vh height
- Alternative: Futuristic command center dashboard mockup

**Supporting Imagery:**
- AI Analysis mockup: Screenshot-style preview of assessment dashboard (place in Analysis section)
- Government setting: Professional boardroom or strategic planning environment (subtle, in Trust section)
- Data visualization: Abstract charts/graphs showing maturity progression
- Keep all images sophisticated, minimal text overlay, tech-forward aesthetic

**Image Specifications:**
- Hero: 1920x1080 minimum, optimized for web
- Dashboard previews: 1200x800 for clarity
- Logo/partner images: Monochrome or desaturated for consistency
- All images should complement violet/indigo/gold palette

## Accessibility & Polish

- Maintain 4.5:1 contrast ratios despite sophisticated palette
- Ensure all CTAs have clear focus states with gold outlines
- Keyboard navigation fully supported across all interactive elements
- Alt text for all imagery emphasizing strategic value
- Reduced motion alternatives for all animations