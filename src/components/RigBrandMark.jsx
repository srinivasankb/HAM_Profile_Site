import { resolveRigBrand } from '../lib/rig-brands';

/**
 * @param {{ rig?: { brandLogo?: string, name?: string }, size?: 'sm' | 'md', className?: string }} props
 */
export default function RigBrandMark({ rig, size = 'md', className = '' }) {
    const brand = resolveRigBrand(rig);
    if (!brand) return null;

    const classes = ['rig-brand-mark', `rig-brand-mark--${size}`, className].filter(Boolean).join(' ');

    return (
        <span className={classes} title={brand.label}>
            <img
                src={brand.src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                    e.currentTarget.closest('.rig-brand-mark')?.remove();
                }}
            />
        </span>
    );
}
