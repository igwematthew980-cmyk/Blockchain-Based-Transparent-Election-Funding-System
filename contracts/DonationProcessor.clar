(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-CANDIDATE (err u101))
(define-constant ERR-INVALID-DONOR (err u102))
(define-constant ERR-NON-COMPLIANT (err u103))
(define-constant ERR-INVALID-AMOUNT (err u104))
(define-constant ERR-INVALID-TIMESTAMP (err u105))
(define-constant ERR-DONATION-EXISTS (err u106))
(define-constant ERR-VAULT-FAIL (err u107))
(define-constant ERR-AUDIT-FAIL (err u108))
(define-constant ERR-COUNTER-OVERFLOW (err u109))
(define-constant ERR-INVALID-STATUS (err u110))
(define-constant ERR-INVALID-CURRENCY (err u111))
(define-constant ERR-INVALID-LOCATION (err u112))
(define-constant ERR-INVALID-COMPLIANCE-PARAM (err u113))
(define-constant ERR-MAX-DONATIONS-EXCEEDED (err u114))
(define-constant ERR-INVALID-DONOR-ID (err u115))
(define-constant ERR-INVALID-CANDIDATE-ID (err u116))
(define-constant ERR-INSUFFICIENT-BALANCE (err u117))
(define-constant ERR-TRANSFER-FAILED (err u118))
(define-constant ERR-REGISTRY-NOT-SET (err u119))
(define-constant ERR-AUTHORITY-NOT-VERIFIED (err u120))

(define-data-var donation-counter uint u0)
(define-data-var max-donations uint u1000000)
(define-data-var min-donation-amount uint u1)
(define-data-var max-donation-amount uint u1000000000)
(define-data-var authority-contract (optional principal) none)
(define-data-var candidate-registry-contract (optional principal) none)
(define-data-var donor-registry-contract (optional principal) none)
(define-data-var compliance-checker-contract (optional principal) none)
(define-data-var fund-vault-contract (optional principal) none)
(define-data-var audit-trail-contract (optional principal) none)
(define-data-var processing-fee uint u100)
(define-data-var active-status bool true)

(define-map Donations
  { donation-id: uint }
  { donor: principal, candidate: principal, amount: uint, timestamp: uint, status: bool, currency: (string-utf8 20), location: (string-utf8 100) }
)

(define-map DonationsByDonor
  { donor: principal }
  { donation-ids: (list 1000 uint) }
)

(define-map DonationsByCandidate
  { candidate: principal }
  { donation-ids: (list 1000 uint) }
)

(define-read-only (get-donation (id uint))
  (map-get? Donations { donation-id: id })
)

(define-read-only (get-donations-by-donor (donor principal))
  (default-to { donation-ids: (list) } (map-get? DonationsByDonor { donor: donor }))
)

(define-read-only (get-donations-by-candidate (candidate principal))
  (default-to { donation-ids: (list) } (map-get? DonationsByCandidate { candidate: candidate }))
)

(define-read-only (get-donation-count)
  (ok (var-get donation-counter))
)

(define-private (validate-amount (amount uint))
  (if (and (>= amount (var-get min-donation-amount)) (<= amount (var-get max-donation-amount)))
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur u"STX") (is-eq cur u"USD") (is-eq cur u"BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (validate-status (status bool))
  (if status
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-donor (donor principal))
  (match (var-get donor-registry-contract)
    reg (contract-call? reg is-donor-verified donor)
    (err ERR-REGISTRY-NOT-SET))
)

(define-private (validate-candidate (candidate principal))
  (match (var-get candidate-registry-contract)
    reg (contract-call? reg is-candidate-verified candidate)
    (err ERR-REGISTRY-NOT-SET))
)

(define-private (check-compliance (donor principal) (candidate principal) (amount uint))
  (match (var-get compliance-checker-contract)
    comp (contract-call? comp is-compliant donor candidate amount)
    (err ERR-REGISTRY-NOT-SET))
)

(define-private (store-in-vault (candidate principal) (amount uint))
  (match (var-get fund-vault-contract)
    vault (contract-call? vault deposit candidate amount)
    (err ERR-REGISTRY-NOT-SET))
)

(define-private (log-in-audit (donation-id uint) (donor principal) (candidate principal) (amount uint) (timestamp uint))
  (match (var-get audit-trail-contract)
    audit (contract-call? audit log-donation donation-id donor candidate amount timestamp)
    (err ERR-REGISTRY-NOT-SET))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-candidate-registry (contract-principal principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set candidate-registry-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-donor-registry (contract-principal principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set donor-registry-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-compliance-checker (contract-principal principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set compliance-checker-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-fund-vault (contract-principal principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set fund-vault-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-audit-trail (contract-principal principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set audit-trail-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-min-donation-amount (new-min uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-min u0) (err ERR-INVALID-AMOUNT))
    (var-set min-donation-amount new-min)
    (ok true)
  )
)

(define-public (set-max-donation-amount (new-max uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max (var-get min-donation-amount)) (err ERR-INVALID-AMOUNT))
    (var-set max-donation-amount new-max)
    (ok true)
  )
)

(define-public (set-processing-fee (new-fee uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set processing-fee new-fee)
    (ok true)
  )
)

(define-public (set-active-status (new-status bool))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set active-status new-status)
    (ok true)
  )
)

(define-public (submit-donation (candidate principal) (amount uint) (currency (string-utf8 20)) (location (string-utf8 100)))
  (let
    (
      (donation-id (var-get donation-counter))
      (donor tx-sender)
      (timestamp block-height)
    )
    (asserts! (var-get active-status) (err ERR-INVALID-STATUS))
    (asserts! (< donation-id (var-get max-donations)) (err ERR-MAX-DONATIONS-EXCEEDED))
    (try! (validate-amount amount))
    (try! (validate-currency currency))
    (try! (validate-location location))
    (try! (validate-donor donor))
    (try! (validate-candidate candidate))
    (try! (check-compliance donor candidate amount))
    (try! (stx-transfer? (var-get processing-fee) tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-VERIFIED))))
    (try! (stx-transfer? amount tx-sender (unwrap! (var-get fund-vault-contract) (err ERR-REGISTRY-NOT-SET))))
    (try! (store-in-vault candidate amount))
    (map-set Donations { donation-id: donation-id }
      { donor: donor, candidate: candidate, amount: amount, timestamp: timestamp, status: true, currency: currency, location: location }
    )
    (let ((donor-ids (get donation-ids (get-donations-by-donor donor))))
      (map-set DonationsByDonor { donor: donor } { donation-ids: (unwrap! (as-max-len? (append donor-ids donation-id) u1000) (err ERR-COUNTER-OVERFLOW)) })
    )
    (let ((candidate-ids (get donation-ids (get-donations-by-candidate candidate))))
      (map-set DonationsByCandidate { candidate: candidate } { donation-ids: (unwrap! (as-max-len? (append candidate-ids donation-id) u1000) (err ERR-COUNTER-OVERFLOW)) })
    )
    (try! (log-in-audit donation-id donor candidate amount timestamp))
    (var-set donation-counter (+ donation-id u1))
    (print { event: "donation-submitted", id: donation-id, donor: donor, candidate: candidate, amount: amount })
    (ok donation-id)
  )
)

(define-public (cancel-donation (donation-id uint))
  (let ((donation (unwrap! (map-get? Donations { donation-id: donation-id }) (err ERR-DONATION-EXISTS))))
    (asserts! (is-eq (get donor donation) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (get status donation) (err ERR-INVALID-STATUS))
    (map-set Donations { donation-id: donation-id }
      (merge donation { status: false })
    )
    (print { event: "donation-cancelled", id: donation-id })
    (ok true)
  )
)