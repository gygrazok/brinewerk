import { Application } from 'pixi.js';
import { updateShaderTime } from './shader-loader';

/** Setup rendering tick — updates shader uniforms */
export function initRenderer(app: Application): void {
  app.ticker.add((tick) => {
    const time = performance.now() / 1000;
    updateShaderTime(time);

    // Individual creature visuals are updated by pool-view (Step 5)
    void tick;
  });
}
