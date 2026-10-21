# Third-Party Notices

PGPlan Insight bundles third-party code, fonts, and icon assets. The project itself is licensed under the PostgreSQL License; these components remain under their own licenses. The release build also contains `THIRD_PARTY_LICENSES.txt`, generated from the locked production dependency tree with the version and license files for every production package.

## PEV2

PGPlan Insight bundles PEV2 v1.25.0 by Dalibo: <https://github.com/dalibo/pev2>. PEV2 is distributed under the PostgreSQL License.

PGPlan Insight applies a reviewed build-time compatibility modification to batch graph-node layout measurements before publishing size updates. This preserves node dimensions and plan metrics while reducing forced layout work. The patch is guarded against the exact upstream package build; the upstream files in node_modules are not edited.

Copyright (c) 2019, Dalibo

Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted, provided that the above copyright notice and this paragraph and the following two paragraphs appear in all copies.

IN NO EVENT SHALL DALIBO BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF DALIBO HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

DALIBO SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS ON AN "AS IS" BASIS, AND DALIBO HAS NO OBLIGATIONS TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.

## Font Awesome Free icons

PEV2 includes Font Awesome Free icon assets by Fonticons, Inc.: <https://fontawesome.com>. The SVG and JavaScript icon assets are licensed under Creative Commons Attribution 4.0 International (CC BY 4.0): <https://creativecommons.org/licenses/by/4.0/>. Attribution: "Font Awesome Free by Fonticons, Inc., https://fontawesome.com, licensed under CC BY 4.0." PGPlan Insight does not claim ownership of these assets. Their associated code is MIT-licensed; see the release-generated dependency license bundle for the package notice.

## IBM Plex fonts

The bundled IBM Plex Sans and IBM Plex Mono font software is copyright 2019 IBM Corp. It is licensed under the SIL Open Font License, Version 1.1. The full license text follows; the license FAQ is at <https://openfontlicense.org/>.

Copyright 2019 IBM Corp. All rights reserved.

SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the copyright statement(s).

"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or substituting - in part or in whole - any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.

5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

TERMINATION
This license becomes null and void if any of the above conditions are not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

## d3-flextree

PEV2 depends on d3-flextree v2.1.2, whose package declares WTFPL Version 2. This paragraph is an attribution summary, not a reproduction or modification of the license. The release-generated `THIRD_PARTY_LICENSES.txt` preserves the exact packaged license text. Project source: <https://github.com/Klortho/d3-flextree>.

## Full dependency inventory

The release gate generates `THIRD_PARTY_LICENSES.txt` from `package-lock.json` and installed production packages, including package versions and available license/notice files. Check that file in the release artifact for the complete locked production dependency inventory. The release report, SBOM, and SHA-256 manifest are also generated by the release gate.
