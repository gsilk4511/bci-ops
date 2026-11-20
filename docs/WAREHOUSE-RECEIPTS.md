# BCI Warehouse receipts

## Parts delivered to BCI Warehouse

From **Warehouse → Receive Parts**, select a catalog part and enter the quantity
actually received. Add supplier, reference, unit cost (with finance access), and
a readable photo when available. The app records the date and time of receipt
and the positive movement. Use **View receipt** in **Activity → Stock movements**
to open the image with receiving access.

## Parts bought for a work order

1. In **Log Materials**, select the part, enter the quantity used, and attach the
   receipt to that material entry. If adding a photo later, select that specific
   material entry in **Add Receipt** rather than attaching it to the work order
   generally. The work order keeps its photo. The material entry records the
   usual stock issue even when warehouse stock was zero.
2. In **Warehouse → Activity → Field purchases**, open and compare the receipt
   to the part and quantity on the work order. If this was a new purchase for
   the job and those units have not already been received, use **Commit to
   Warehouse**. The app adds back the quantity on the linked line once, does not
   add another job charge, and keeps the purchase receipt linked. A purchase of
   six units and issue of six units nets to zero if on-hand started at zero.
3. If a receipt is ambiguous or the material issue changed, reconcile the
   difference before changing the stock count. General work-order attachments
   do not get a commit button. A committed receipt is a physical purchase:
   correcting or archiving a work order does not erase that receipt. Normal
   edit and archive stock reversals still apply to the work-order issue.

Do not use **Receive Parts** on the same units already committed from a field
purchase. Enter any extra units actually brought back to the warehouse as a
separate receipt, not as part of the work-order offset.

Field photos require access to the originating work order and its receipts.
Committing requires receiving permission. Warehouse receipt images are behind
the app's access checks, not public links. Existing location counts are not
transferred by this update.
