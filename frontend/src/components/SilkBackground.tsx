import { Silk } from './Silk';

interface SilkBackgroundProps {
  className?: string;
}

export function SilkBackground({ className = '' }: SilkBackgroundProps) {
  return (
    <div
      className={`silk-background${className ? ` ${className}` : ''}`}
      data-testid="silk-background"
      aria-hidden="true"
    >
      <Silk
        speed={5}
        scale={1}
        color="#7B7481"
        noiseIntensity={1.5}
        rotation={0}
      />
    </div>
  );
}
