# Delivery module

A delivery is one run of a vehicle: packages are loaded from the warehouse or from transport jobs and taken to one or more customers. Each customer gets their own delivery note, which they sign on receipt.

## Use
1. **Operations › Delivery** in the left menu, below Pickup (permission `delivery.manage` or `operations.manage`) → **Create delivery** with the date, time and expected duration.
2. **Load packages** (only before the delivery leaves):
   - **From warehouse**: boxes in warehouse stock.
   - **From jobs**: boxes on a transport job that has **departed or arrived**.
   - A box loaded onto a job is not warehouse stock, so it can only be added from its job. A box can be on only one delivery at a time.
   - A **delivery note** (`DN-…`) is created for each customer, with the receiver, phone and address copied from the warehouse receipt or job shipping details. Use **Receiver** to correct them.
   - **Remove** takes a package off again; a warehouse box goes back to its location.
3. **Crew & driver** tab: vehicle (Operations setup › Vehicles), driver and crew with roles, or **Assign a team**. The driver and crew are booked for the scheduled window, so double bookings with pickups, packing jobs and other deliveries are refused.
4. **Start delivery** on the trip card (needs at least one package). Pause with a reason and resume as needed.
5. **Delivery notes** tab, for each package: **Delivered** (received by, condition) or **Not delivered** (reason). **Undo** sets it back to loaded.
6. **Take signature** on a customer's note: tick the packages received, enter who signs, add remarks, and the customer signs on screen. Ticked packages are marked delivered. The signature is stored with the exact list it covers, and the note's packages are then locked.
7. **Delivery note** prints that customer's note: their packages and status, the vehicle and driver, and the captured signature once signed.
8. **Collections & expenses** tab: **Collect payment** (optionally against a customer's note; prints a receipt) and **Record expense** (fuel, tolls…, categories from `expense-category`). Each entry has its own currency and exchange-rate snapshot.
9. **End delivery** on the trip card with the **distance covered** (km). Every package must be marked delivered or not delivered first. The distance can be corrected afterwards.
10. **Customer links** on a note (before it is signed): each customer gets their own links, sent by WhatsApp or copied. Each has its own card (status, validity 1–30 days, **Create link** / **New link**, **Revoke**). Only a hash of the token is stored, so a link is shown once; a new link for the same purpose replaces the old one. The customer sees only their own note, never other customers on the run.
   - **Confirm delivery date** (`/delivery-date/<token>`): the customer taps *Yes, this time works* or asks for another time. A run serves several customers, so a request does not move the run: the note shows *Asks for …* and the office reschedules the run or delivers that customer on another run. Rescheduling the run marks earlier answers *outdated*.
   - **Share location** (`/delivery-location/<token>`): the customer shares the phone's GPS (shown on a map), can correct the delivery address and add directions for the driver. The note shows the address with **GPS** linked to Maps.
11. **Cancel delivery** is allowed while nothing has been delivered; loaded warehouse packages go back to their locations.

## Package custody
| Event | Pickup boxes (handover history) | Warehouse stock |
|---|---|---|
| Loaded from warehouse | `IN_TRANSIT` at the delivery number | Leaves stock |
| Loaded from a job | No change; the box stays on its job | Already not in stock |
| Delivered (on completion) | `DELIVERED` at the delivery address, received by the signer | Never returns to stock |
| Not delivered, warehouse box (on completion) | `WAREHOUSE` at its original location | Back in stock |
| Not delivered, job box | No change; stays with the job | — |
| Delivery cancelled | `WAREHOUSE` for warehouse boxes | Back in stock |

Office-received boxes have no handover history; they follow the stock column only.

## Accounting
- Collections and expenses appear in the accountant's cash-posting queue (Billing › Cash) as source `DELIVERY`, labelled with the customer when the money was collected against a note. Posting follows the same rules as pickup and packing money.
- **Invoicing & billing** tab (`billing.view`): charges, invoices and bills with source `DELIVERY`.
- **Operation profitability** (Accounting reports) has a `DELIVERY` operation type.

## API (`/api/delivery`, policy `delivery.manage`, also satisfied by `operations.manage`)

| Purpose | Endpoint |
|---|---|
| Lookups | `GET masters`: employees, vehicles, crew roles, payment methods, income purposes, expense categories |
| Loadable packages | `GET available`: `warehouse` stock and `jobs` boxes on departed/arrived jobs |
| Deliveries | `GET` / `POST` / `GET {id}` / `PUT {id}` (`scheduledAtUtc`, `durationMinutes`, `notes`) |
| Loading | `POST {id}/load` (`warehouseBoxIds`, `jobBoxes` [{jobId, boxId}]) / `DELETE {id}/items/{itemId}` |
| Packages | `PUT {id}/items/{itemId}/status` (`DELIVERED`, `RETURNED` = not delivered, `LOADED`; `receivedBy`, `notes`) |
| Notes | `PUT {id}/notes/{noteId}` (receiver, phone, address) / `POST {id}/notes/{noteId}/sign` (`signerName`, `signaturePng` PNG data URL, `remarks`, `deliveredItemIds`) |
| Crew | `PUT {id}/crew` (`crew` [{employeeId, role}], `driverEmployeeId`, `vehicleId`) |
| Trip | `POST {id}/trip/start` / `pause` (`reason`) / `resume` / `complete` (`distanceKm`); `PUT {id}/trip/distance` |
| Cancel | `POST {id}/cancel` |
| Money | `POST {id}/transactions` (`INCOME` / `EXPENSE`, optional `deliveryNoteId` for income) |
| Customer links | `POST {id}/notes/{noteId}/links` (`purpose` SCHEDULE / LOCATION, `validDays` 1–30; returns `url`) / `DELETE {id}/notes/{noteId}/links/{purpose}` |

Customer (anonymous) API `/api/public/delivery-notes/{token}`: `GET`, `POST schedule` (`confirmed`, `preferredAtUtc` when not confirmed), `POST location` (`latitude`, `longitude`, optional `address`, `notes`).

Report Engine types: `DELIVERY_NOTE` (query `noteId`; prints the captured signature above the customer signature line) and `DELIVERY_RECEIPT` (query `transactionId`). Designs are editable in Report designs.

## Storage
Tables:
- `DeliveryJobs` (number `DL-…`, concurrency `Version`, vehicle, driver, trip times, `DistanceKm`)
- `DeliveryJobTimeEvents` (trip steps)
- `DeliveryJobCrew`
- `DeliveryNotes` (number `DN-…`, one per customer; signature PNG, signer, remarks and the signed package list; the customer's date answer and shared GPS location)
- `DeliveryNoteLinks` (one customer link per note and purpose: token hash, expiry)
- `DeliveryItems` (package snapshot, source `WAREHOUSE`/`JOB`, status)
- `DeliveryJobTransactions` (number `DLT-…`)

A box is held by a delivery while the run is planned or out, and permanently once delivered. Held boxes count as assigned, the same as boxes on an active job: they leave warehouse stock and cannot get manual handovers.

Existing databases are upgraded at startup by `DeliverySchema` (SQL Server and PostgreSQL). The same DDL is in `database/scripts/*/029_delivery.sql` and `030_delivery_customer_links.sql`, and `database/generated/*` has been regenerated.

## Code
| Layer | Location |
|---|---|
| Domain | `Movers.Domain/Delivery/DeliveryEntities.cs` |
| DAL | `Movers.DAL/Delivery/` |
| Service | `Movers.Services/Delivery/DeliveryService.cs` |
| API | `Movers.Api/Controllers/DeliveryController.cs` |
| Frontend | `src/deliveryApi.ts`, `src/pages/DeliveryJobsPage.tsx`, `src/pages/DeliveryJobDetailPage.tsx`, `src/components/delivery/DeliveryCustomerLinks.tsx`, customer pages `src/pages/CustomerDeliveryLinkPages.tsx` |

Tests: `DeliveryApiTests.cs`, and `tests/reporting-v2.test.mjs` for the delivery note layout.
