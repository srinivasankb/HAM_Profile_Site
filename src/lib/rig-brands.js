const RIG_BRANDS_BASE = '/images/rig-brands';

/**
 * @param {{ brandLogo?: string, name?: string } | null | undefined} rig
 * @returns {{ src: string, label: string } | null}
 */
export function resolveRigBrand(rig) {
    if (!rig?.brandLogo) return null;

    const label = rig.name?.split(/\s+/)[0] ?? rig.brandLogo.replace(/\.[^.]+$/, '');

    return {
        src: `${RIG_BRANDS_BASE}/${rig.brandLogo}`,
        label,
    };
}
