import React from 'react';
import { getPid, logCvOnce } from '../lib/afTracking';

/**
 * ApplyLink Component
 * A robust wrapper for conversion tracking on CTA buttons.
 * 
 * @param {string} href - Destination URL
 * @param {boolean} addPid - Whether to append pid to the outbound URL
 * @param {React.ReactNode} children - Button/Link content
 * @param {string} className - Optional styling
 */
const ApplyLink = ({ href, addPid = true, children, className = '', ...props }) => {

    const handleClick = async (e) => {
        e.preventDefault();

        const pid = getPid();

        // Log CV in background (fire and forget with a tiny wait)
        if (pid) {
            logCvOnce(pid);
        }

        // Build final destination URL
        let finalHref = href;
        if (pid && addPid) {
            const url = new URL(href, window.location.origin);
            url.searchParams.set('pid', pid);
            finalHref = url.toString();
        }

        // UX: Give the tracker a tiny moment to start the request before navigation
        // 120ms is barely noticeable but helps ensure the fetch request is dispatched
        setTimeout(() => {
            window.location.href = finalHref;
        }, 120);
    };

    return (
        <a
            href={href}
            onClick={handleClick}
            className={className}
            {...props}
        >
            {children}
        </a>
    );
};

export default ApplyLink;
