import React from 'react';
import { Composition } from 'remotion';
import { VideoPlan } from '../plan/schema';
import { SAMPLE_PLAN } from '../plan/sample';
import { MotionVideo } from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotionVideo"
    component={MotionVideo}
    defaultProps={SAMPLE_PLAN as VideoPlan}
    schema={VideoPlan}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.ceil((props.durationMs / 1000) * props.fps)),
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
