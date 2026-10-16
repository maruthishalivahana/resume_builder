// Ground truth is independent from generated text and actual classifications.
function summarizeUnseen(rows) {
  const rate=(n,d)=>({numerator:n,denominator:d,value:d?n/d:null});
  const count=fn=>rows.filter(fn).length;
  const truePos=rows.reduce((n,r)=>n+r.retrievedAnchors.filter(a=>r.relevant.includes(a)).length,0);
  const retrieved=rows.reduce((n,r)=>n+r.retrievedAnchors.length,0);
  const relevant=rows.reduce((n,r)=>n+r.relevant.length,0);
  const forbidden=rows.filter(r=>r.expectedClassification==='MISSING'||r.expectedClassification==='CONFLICT');
  return {
    extraction:rate(count(r=>r.extracted),rows.length),
    classification:rate(count(r=>r.classification===r.expectedClassification),rows.length),
    falseStrong:rate(count(r=>r.classification==='STRONG'&&r.expectedClassification!=='STRONG'),count(r=>r.expectedClassification!=='STRONG')),
    missedStrong:rate(count(r=>r.classification!=='STRONG'&&r.expectedClassification==='STRONG'),count(r=>r.expectedClassification==='STRONG')),
    retrievalPrecision:rate(truePos,retrieved),retrievalRecall:rate(truePos,relevant),
    missedEvidence:rows.flatMap(r=>r.relevant.filter(a=>!r.retrievedAnchors.includes(a)).map(anchor=>({id:r.id,anchor}))),
    falseSupportingRecords:forbidden.reduce((n,r)=>n+r.supportingAnchors.length,0),
    forbiddenSupportCases:forbidden.length,
    invalidSuggestionReferences:count(r=>r.referencesValid===false),
  };
}
module.exports={summarizeUnseen};
