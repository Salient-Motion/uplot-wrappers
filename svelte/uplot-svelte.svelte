<script>
    import uPlot from 'uplot';
    import { onDestroy, onMount } from 'svelte';

    export let options;
    export let data;
    export let target = null;
    export let onDelete;
    export let onCreate;
    export let resetScales = true;
    let className;
    export { className as class };

    let chart = null;
    let div = null;

    const optionsUpdateState = (_lhs, _rhs) => {
        const { width: lhsWidth, height: lhsHeight, ...lhs } = _lhs;
        const { width: rhsWidth, height: rhsHeight, ...rhs } = _rhs;

        let state = 'keep';
        if (lhsHeight !== rhsHeight || lhsWidth !== rhsWidth) {
            state = 'update';
        }
        if (Object.keys(lhs).length !== Object.keys(rhs).length) {
            return 'create';
        }
        for (const k of Object.keys(lhs)) {
            if (!Object.is(lhs[k], rhs[k])) {
                state = 'create';
                break;
            }
        }
        return state;
    };

    // If the only difference between the previous and next options is the
    // min/max of one or more scales, returns the changed scales so they can be
    // applied via `setScale` (wrapped in `batch`) instead of re-creating the
    // chart. Returns null when any other (structural) difference is present.
    const scaleRangeUpdates = (prev, next) => {
        const ignored = new Set(['width', 'height', 'scales']);
        const prevKeys = Object.keys(prev).filter((k) => !ignored.has(k));
        const nextKeys = Object.keys(next).filter((k) => !ignored.has(k));

        if (prevKeys.length !== nextKeys.length) {
            return null;
        }
        for (const k of prevKeys) {
            if (!Object.is(prev[k], next[k])) {
                return null;
            }
        }

        const prevScaleMap = prev.scales || {};
        const nextScaleMap = next.scales || {};
        if (Object.keys(prevScaleMap).length !== Object.keys(nextScaleMap).length) {
            return null;
        }

        const changes = [];
        for (const key of Object.keys(nextScaleMap)) {
            if (!(key in prevScaleMap)) {
                return null;
            }
            const prevScale = prevScaleMap[key];
            const nextScale = nextScaleMap[key];
            for (const prop of Object.keys({ ...prevScale, ...nextScale })) {
                if (prop === 'min' || prop === 'max') {
                    continue;
                }
                if (!Object.is(prevScale[prop], nextScale[prop])) {
                    return null;
                }
            }
            if (!Object.is(prevScale.min, nextScale.min) || !Object.is(prevScale.max, nextScale.max)) {
                if (typeof nextScale.min !== 'number' || typeof nextScale.max !== 'number') {
                    return null;
                }
                changes.push({ key, min: nextScale.min, max: nextScale.max });
            }
        }
        return changes;
    };

    const destroy = () => {
        if (chart) {
            onDelete(chart);
            chart.destroy();
            chart = null;
        }
    };

    const create = () => {
        if (!target && !div) {
            typeof requestAnimationFrame !== 'undefined' && requestAnimationFrame(() => create());
            return;
        }
        if (!chart) {
            chart = new uPlot(options, data, target || div);
            onCreate(chart);
        }
    };

    onMount(async () => {
        create();
    });

    onDestroy(() => {
        destroy();
    });

    let prevOptions = { ...options };

    $: {
        if (options) {
            // When the only change is the min/max of one or more scales, apply
            // it live with `setScale` rather than tearing down the chart.
            const scaleChanges = chart ? scaleRangeUpdates(prevOptions, options) : null;
            if (chart && scaleChanges) {
                const sizeChanged =
                    prevOptions.width !== options.width || prevOptions.height !== options.height;
                prevOptions = { ...options };
                if (sizeChanged) {
                    chart.setSize({ width: options.width, height: options.height });
                }
                // Batch the scale updates so the chart redraws once, regardless
                // of how many scales changed.
                if (scaleChanges.length) {
                    chart.batch(() => {
                        for (const { key, min, max } of scaleChanges) {
                            chart.setScale(key, { min, max });
                        }
                    });
                }
            } else {
                const state = optionsUpdateState(prevOptions, options);
                prevOptions = { ...options };
                if (state === 'create') {
                    destroy();
                    create();
                } else if (state === 'update' && chart) {
                    chart.setSize({
                        width: options.width,
                        height: options.height,
                    });
                }
            }
        }
    }

    $: if (target) {
        destroy();
        create();
    }

    $: {
        if (!chart) {
            create();
        } else if (resetScales) {
            chart.setData(data, true);
        } else {
            chart.setData(data, false);
            chart.redraw();
        }
    }
</script>

{#if !target}
    <div bind:this={div} class={className}></div>
{/if}
