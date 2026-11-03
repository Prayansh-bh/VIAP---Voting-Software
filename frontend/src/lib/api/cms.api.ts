/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InchargeNode {
  id: string;
  name: string;
  code?: string;
  totalVoters?: number;
  incharge?: {
    id: string;
    userName: string;
    mobileNumber: string;
    role: string;
    accountStatus: string;
  } | null;
}

export interface InchargeHierarchyTree {
  constituency: InchargeNode;
  mandals: (InchargeNode & {
    villages: (InchargeNode & {
      booths: (InchargeNode & {
        boothNumber: string;
        voterGroups: InchargeNode[];
      })[];
    })[];
  })[];
}
