// Recorded responses from eBPCOBackend, copied verbatim from
// `contract/response-samples.json` (contractVersion "0.1.0") on 2 September 2026.
//
// These are REAL BYTES from the real controllers over real PostgreSQL, not
// shapes anyone invented. The backend's own parity spec fails if its OpenAPI
// contract and these samples disagree in either direction, so decoding against
// them is verification rather than assumption.
//
// Do not hand-edit. Re-copy from that file if the contract moves.
export const CONTRACT_SAMPLES = {
    "me.applicant": {
        "status": 200,
        "body": {
            "id": "00000000-0000-4000-8000-000000000000",
            "kind": "applicant",
            "email": "maria.santos@example.ph",
            "emailVerifiedAt": null,
            "firstName": "Maria",
            "middleName": null,
            "lastName": "Santos",
            "mobileNumber": null,
            "street": null,
            "barangay": null,
            "city": null,
            "province": null,
            "postalCode": null
        }
    },
    "me.rectify": {
        "status": 200,
        "body": {
            "firstName": "Maria Cristina",
            "middleName": null,
            "lastName": "Santos",
            "mobileNumber": null,
            "street": "12 Rizal Street",
            "barangay": "Poblacion Uno",
            "city": "Castilla",
            "province": "Sorsogon",
            "postalCode": "4718",
            "mobileVerifiedAt": null,
            "mobileVerificationCleared": false
        }
    },
    "applicant.applications.permit": {
        "status": 200,
        "body": {
            "permitNumber": "FP-2026-000001",
            "issuedDate": "2026-01-01T00:00:00.000Z",
            "scope": "Perimeter fence, 42 linear metres, hollow block on reinforced concrete footing",
            "conditions": [
                "Maintain a 1.5m setback from the property line."
            ],
            "release": {
                "status": "Ready for Release",
                "method": null,
                "releasedAt": null
            }
        }
    },
    "applicant.applications.permit.beforeRelease": {
        "status": 200,
        "body": {
            "permitNumber": "FP-2026-000001",
            "issuedDate": "2026-01-01T00:00:00.000Z",
            "scope": "Perimeter fence, 42 linear metres, hollow block on reinforced concrete footing",
            "conditions": [
                "Maintain a 1.5m setback from the property line."
            ],
            "release": null
        }
    },
    "applicant.applications.documents": {
        "status": 200,
        "body": [
            {
                "id": "00000000-0000-4000-8000-000000000000",
                "label": "Valid identity document",
                "fileName": "psa-birth-certificate.pdf",
                "contentType": "application/pdf",
                "byteSize": "182344",
                "sha256": "3b1f2c9a4d8e7f60112233445566778899aabbccddeeff00112233445566778f",
                "uploadedAt": "2026-01-01T00:00:00.000Z",
                "expiresOn": null,
                "reviewStatus": null,
                "reviewedAt": null,
                "reviewReason": null,
                "reviewRemark": null,
                "supersedesDocumentId": null,
                "supersededByDocumentId": null,
                "scanCleared": true,
                "quarantined": false
            },
            {
                "id": "00000000-0000-4000-8000-000000000000",
                "label": "Lot plan",
                "fileName": "lot-plan.pdf",
                "contentType": "application/pdf",
                "byteSize": "941233",
                "sha256": "7c2e5a1b9f3d4068223344556677889900aabbccddeeff00112233445566aa91",
                "uploadedAt": "2026-01-01T00:00:00.000Z",
                "expiresOn": null,
                "reviewStatus": "Rejected",
                "reviewedAt": "2026-01-01T00:00:00.000Z",
                "reviewReason": {
                    "code": "illegible",
                    "label": "Illegible",
                    "description": "The scan or photograph cannot be read."
                },
                "reviewRemark": "Page 3 is cut off at the right margin -- the setback dimension cannot be read.",
                "supersedesDocumentId": null,
                "supersededByDocumentId": null,
                "scanCleared": true,
                "quarantined": false
            }
        ]
    },
    "applicant.applications.resubmitDocument": {
        "status": 201,
        "body": {
            "documentId": "00000000-0000-4000-8000-000000000000",
            "supersedesDocumentId": "00000000-0000-4000-8000-000000000000",
            "status": "Pending",
            "removedMetadata": []
        }
    },
    "problem.notFound": {
        "status": 404,
        "body": {
            "type": "/problems/not-found",
            "title": "No such resource",
            "status": 404,
            "detail": "No such application.",
            "instance": "/staff/applications/00000000-0000-4000-8000-000000000000",
            "correlationId": "00000000-0000-4000-8000-000000000000"
        }
    },
    "problem.missingApplicantIdempotencyKey": {
        "status": 400,
        "body": {
            "type": "/problems/validation-failed",
            "title": "The request did not validate",
            "status": 400,
            "instance": "/applications",
            "correlationId": "00000000-0000-4000-8000-000000000000",
            "errors": [
                {
                    "pointer": "/",
                    "message": "Expected string, received null"
                }
            ]
        }
    }
};
