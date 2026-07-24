import uPlot from 'uplot';

type OptionsUpdateState = 'keep' | 'update' | 'create';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
if (!Object.is) {
    // eslint-disable-next-line
    Object.defineProperty(Object, "is", {value: (x: any, y: any) =>
        (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)
    });
}

export const optionsUpdateState = (_lhs: uPlot.Options, _rhs: uPlot.Options): OptionsUpdateState => {
    const {width: lhsWidth, height: lhsHeight, ...lhs} = _lhs;
    const {width: rhsWidth, height: rhsHeight, ...rhs} = _rhs;

    let state: OptionsUpdateState = 'keep';
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
}

export type ScaleRangeChange = { key: string; min: number; max: number };

// If the only difference between the previous and next options is the min/max
// of one or more scales, returns the list of changed scales so they can be
// applied via `setScale` (wrapped in `batch`) instead of destroying and
// re-creating the chart. Returns `null` when any other (structural) difference
// is present, in which case the caller should fall back to `optionsUpdateState`.
export const scaleRangeUpdates = (prev: uPlot.Options, next: uPlot.Options): ScaleRangeChange[] | null => {
    // The size and the scales are compared separately: size differences are
    // handled by the caller via `setSize`, scale min/max via `setScale` below.
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

    const changes: ScaleRangeChange[] = [];
    for (const key of Object.keys(nextScaleMap)) {
        if (!(key in prevScaleMap)) {
            return null;
        }
        const prevScale = prevScaleMap[key];
        const nextScale = nextScaleMap[key];
        // Any non-min/max scale property change requires a full re-create.
        for (const prop of Object.keys({...prevScale, ...nextScale})) {
            if (prop === 'min' || prop === 'max') {
                continue;
            }
            if (!Object.is(prevScale[prop], nextScale[prop])) {
                return null;
            }
        }
        if (!Object.is(prevScale.min, nextScale.min) || !Object.is(prevScale.max, nextScale.max)) {
            // `setScale` only accepts numeric limits; a reset back to auto-ranging
            // (undefined min/max) needs the regular create/update handling.
            if (typeof nextScale.min !== 'number' || typeof nextScale.max !== 'number') {
                return null;
            }
            changes.push({key, min: nextScale.min, max: nextScale.max});
        }
    }
    return changes;
}

export const dataMatch = (lhs: uPlot.AlignedData, rhs: uPlot.AlignedData): boolean => {
    if (lhs.length !== rhs.length) {
        return false;
    }
    return lhs.every((lhsOneSeries, seriesIdx) => {
        const rhsOneSeries = rhs[seriesIdx];
        if (lhsOneSeries.length !== rhsOneSeries.length) {
            return false;
        }
        return lhsOneSeries.every((value: number, valueIdx: number) => value === rhsOneSeries[valueIdx]);
    });
}
