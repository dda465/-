async function run() {
    try {
        console.log("Fetching quotes from Firestore REST API...");
        const url = "https://firestore.googleapis.com/v1/projects/rejeuphone/databases/(default)/documents/quotes?pageSize=300";
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        
        const data = await response.json();
        const documents = data.documents || [];
        console.log(`Total quotes fetched: ${documents.length}`);
        
        let paidCount = 0;
        let paidWithPaidAt = 0;
        let paidWithFirebaseTimestamp = 0;
        let paidWithTimestamp = 0;
        let paidInJune2026 = 0;
        
        for (const docObj of documents) {
            const fields = docObj.fields || {};
            const status = fields.status && fields.status.stringValue ? fields.status.stringValue : '신청접수';
            
            if (status === '입금완료') {
                paidCount++;
                if (fields.paidAt) paidWithPaidAt++;
                if (fields.firebaseTimestamp) paidWithFirebaseTimestamp++;
                if (fields.timestamp) paidWithTimestamp++;
                
                // Let's determine the payment date
                let pDate = null;
                if (fields.paidAt) {
                    if (fields.paidAt.timestampValue) {
                        pDate = new Date(fields.paidAt.timestampValue);
                    }
                } else if (fields.customerAgreedAt && fields.customerAgreedAt.timestampValue) {
                    pDate = new Date(fields.customerAgreedAt.timestampValue);
                }
                
                if (pDate) {
                    const year = pDate.getFullYear();
                    const month = pDate.getMonth(); // 0-indexed
                    if (year === 2026 && month === 5) { // June is month index 5
                        paidInJune2026++;
                    }
                }
            }
        }
        
        console.log(`Total '입금완료' quotes: ${paidCount}`);
        console.log(`  With paidAt: ${paidWithPaidAt}`);
        console.log(`  With firebaseTimestamp: ${paidWithFirebaseTimestamp}`);
        console.log(`  With timestamp: ${paidWithTimestamp}`);
        console.log(`  Paid in June 2026 (based on paidAt/customerAgreedAt): ${paidInJune2026}`);
        
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
