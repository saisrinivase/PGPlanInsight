# Copyright and License Review

Review date: 2026-10-10

This is a repository-level engineering review, not a legal opinion or proof of originality.

## First-party project license

- The project owner selected the PostgreSQL License for first-party PGPlan Insight code, replacing the earlier uncommitted MIT draft.
- The root `LICENSE` is the source of the grant; `package.json` and the lockfile root declare the SPDX identifier `PostgreSQL`.
- The copyright line names `PGPlan Insight contributors`, as selected by the project owner. The visible Git history was checked for author identities, but Git authorship metadata does not establish legal ownership or assignment.
- The package remains marked `private: true` to prevent accidental npm publication. This does not withdraw the PostgreSQL License for copies of the source repository.

Before public release, the project owner must confirm that all first-party contributions, including work created in an employment or contracting context, are authorized for this license. No source-file copyright header is added: the root license covers project code, and individual headers would duplicate notices without proving chain of title.

## Third-party components

- PEV2 1.23.0 by Dalibo is bundled under the PostgreSQL License; the copyright and required notice text are included in `public/THIRD_PARTY_NOTICES.md` and copied into the distribution.
- Font Awesome Free icon assets are bundled transitively through PEV2. The icon package declares CC-BY-4.0 and MIT; attribution and the CC-BY-4.0 link are in the shipped notices. The generated production dependency bundle carries package-specific license text where the package includes it.
- IBM Plex Sans and IBM Plex Mono font packages declare OFL-1.1. Copyright and the license text are included in the shipped notices.
- PEV2 depends on d3-flextree 2.1.2 under WTFPL. Its notice is included in the shipped notices.
- `npm run release:gate` builds `dist/THIRD_PARTY_LICENSES.json` and `dist/THIRD_PARTY_LICENSES.txt` from the lockfile and installed production packages. The verifier checks the inventory against release license evidence and hashes the distributable files.

## Originality and ownership limits

A repository scan found no obvious copied third-party prose or source attributions omitted from the files reviewed. This is not a plagiarism scan, code-similarity search, provenance proof, or legal determination. It cannot establish who owns the diagnostic rules, whether work was created within an employer's scope, or whether all contributors authorized redistribution. The project owner must confirm that chain of title before final public release.
