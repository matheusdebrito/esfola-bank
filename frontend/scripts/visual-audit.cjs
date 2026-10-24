/* Isolated UI screenshot audit; fake, non-sensitive data only. */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const out = path.resolve(process.cwd(), "visual-audit-output");
fs.mkdirSync(out, { recursive: true });
const loanId="11111111-1111-4111-8111-111111111111";
const clientId="22222222-2222-4222-8222-222222222222";
const date=(offset=0)=>new Date(Date.now()+offset*86400000).toISOString();
const user={id:"33333333-3333-4333-8333-333333333333",name:"Gestor de Demonstração",role:"ADMIN",email:"gestor@example.test",permissions:[
  "loans:create","loans:read","clients:create","clients:read","clients:update","clients:delete","payments:register","payments:read","finance:read","finance:write",
]};
const client={id:clientId,name:"Cliente Exemplo com Nome Comprido de Oliveira",cpf:"00000000000",cpfMasked:"***.***.***-00",phone:"21999999999",birthDate:"1980-01-01",cep:"20000000",address:"Rua de Teste",number:"123",neighborhood:"Centro",city:"Rio de Janeiro",state:"RJ",active:true};
const loan={id:loanId,code:"EMP-2026-0001",clientId,clientName:client.name,clientCpfMasked:client.cpfMasked,principalAmount:12000,interestRatePercent:12.5,periodicity:"MONTHLY",installmentCount:10,status:"ACTIVE",grantedAt:date(-30),startDate:date(-20),dueDate:date(15),policyId:"44444444-4444-4444-8444-444444444444",policyName:"Padrão",userId:user.id};
const installment=(i)=>({id:"00000000-0000-4000-8000-"+String(i).padStart(12,"0"),clientId,loanId,clientName:client.name,clientPhone:client.phone,loanCode:loan.code,number:i,dueDate:date(-1-i),principalDue:1000,interestDue:125,chargesDue:0,totalDue:1125,updatedTotalDue:1215.25,paidAmount:200,remainingBalance:925,updatedRemainingBalance:1015.25,lateCharges:{lateFee:20,lateInterest:70.25,totalLateCharges:90.25},daysOverdue:3+i,status:"PARTIALLY_PAID",effectiveStatus:"OVERDUE",isOverdue:true});
const installments=Array.from({length:9},(_,i)=>installment(i+1));
const overview={
 totalGranted:60000,openPortfolio:54680.28,receivedTotal:18450.98,interestReceived:2400,
 receivedPrincipal:15800,receivedInterest:2200,receivedCharges:450.98,overdueClients:5,lateChargesOutstanding:450,
 overdueAmount:12480.75,activeLoans:18,activeClients:12,dueToday:3,dueNext7Days:12,dueNext7Amount:16800.13,
 collectionPerformance:{scheduled:23700,settled:18450,rate:77.85},overdueInstallments:9,delinquencyRate:22.82,
 receivableInPeriod:26000,
 receiptsSeries:[],
 financialFlow:["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"].map((month,i)=>({month,granted:9500+i*700,received:7800+i*1500,predicted:12000+i*950})),
 portfolioComposition:[{name:"A vencer",value:42200},{name:"Em atraso",value:12480}],
 installmentStatus:{paid:45,pending:32,partiallyPaid:9,overdue:9,canceled:1},
 aging:[{bucket:"1–7",amount:1500,count:2},{bucket:"8–30",amount:3200,count:3},{bucket:"31–60",amount:3500,count:2},{bucket:"61+",amount:4280,count:2}],
 topClients:[{clientId,clientName:client.name,outstandingBalance:18500,overdueAmount:4300}],
 upcomingDue:[],
 overdueList:installments.slice(0,6).map(i=>({clientId,loanId,clientName:i.clientName,loanCode:i.loanCode,installmentNumber:i.number,dueDate:i.dueDate,updatedRemainingBalance:i.updatedRemainingBalance,lateCharges:90.25,daysOverdue:i.daysOverdue}))
};
const finance={initialized:true,startedAt:date(-30),openingBalance:20000,availableBalance:17320.44,received:18450.98,principalRecovered:15800,interestReceived:2200,chargesReceived:450.98,contributions:3000,withdrawals:500,expenses:750.54,disbursements:22880,operationalCashResult:1900.44};
const payments=installments.slice(0,5).map((i,k)=>({id:i.id,clientId,clientName:client.name,loanCode:loan.code,loanId,receivedAmount:250+k*100,receivedAt:date(-k),registeredAt:date(-k),status:"REGISTERED",method:"PIX",userName:user.name,allocations:[{installmentNumber:i.number}]}));
function paged(items){return {items,meta:{page:1,pageSize:20,total:items.length,totalPages:1}};}
function mocked(url) {
  const pathname=new URL(url).pathname;
  if(pathname==="/api/v1/auth/me")return {user};
  if(pathname.includes("dashboards/loan-status"))return {current:20,soon:3,overdue:5,total:28,activePrincipal:320000};
  if(pathname.includes("dashboards/overview"))return overview;
  if(pathname.includes("dashboards/upcoming-due"))return paged(installments.slice(0,5).map(i=>({loanId,clientId,loanCode:loan.code,clientName:i.clientName,installmentNumber:i.number,dueDate:date(i.number),remainingBalance:i.remainingBalance,status:"PENDING"})));
  if(pathname.includes("finance/cash-flow"))return {initialized:true,months:["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"].map((month,i)=>({month,incoming:17000+i*3400,outgoing:8500+i*1100,balance:45000+i*18500}))};
  if(pathname.includes("finance/overview"))return finance;
  if(pathname.includes("finance/eligible-loans"))return [loan];
  if(pathname.includes("finance/entries"))return paged(payments.map((p,i)=>({id:p.id,type:i%2?"EXPENSE":"PAYMENT",amount:p.receivedAmount,date:p.receivedAt,description:"Pagamento de cliente / movimentação de teste",loanId,reversed:false,userName:"Gestor",balanceAfter:12000+i*200,source:i%2?"MANUAL":"PAYMENT"})));
  if(pathname.includes("financial-policies"))return paged([{id:loan.policyId,name:"Padrão",active:true,interestRatePercent:12.5}]);
  if(pathname.includes("loans/") && !pathname.includes("installments"))return {loan:{...loan,payments}};
  if(pathname.includes("loans"))return paged(Array.from({length:10},(_,i)=>({...loan,id:i===0?loanId:"55555555-5555-4555-8555-"+String(i).padStart(12,"0"),code:"EMP-2026-"+String(i+1).padStart(4,"0")})));
  if(pathname.includes("installments"))return paged(installments);
  if(pathname.includes("clients/") && pathname.includes("documents"))return {documents:[]};
  if(pathname.includes("clients"))return paged(Array.from({length:8},(_,i)=>({...client,id:i===0?clientId:"66666666-6666-4666-8666-"+String(i).padStart(12,"0")})));
  if(pathname.includes("payments"))return paged(payments);
  if(pathname.includes("users"))return paged([user]);
  if(pathname.includes("audit"))return paged([]);
  return paged([]);
}
const cases=[
  {route:"/login",width:375,height:812,name:"login-mobile"},
  {route:"/login",width:1280,height:900,name:"login-desktop"},
  {route:"/dashboard",width:320,height:700,name:"dashboard-320"},
  {route:"/dashboard",width:375,height:812,name:"dashboard-mobile"},
  {route:"/dashboard",width:768,height:1024,name:"dashboard-tablet"},
  {route:"/dashboard",width:1280,height:900,name:"dashboard-desktop"},
  {route:"/defaults",width:375,height:812,name:"collections-mobile"},
  {route:"/defaults",width:1280,height:900,name:"collections-desktop"},
  {route:"/finance",width:375,height:812,name:"finance-mobile"},
  {route:"/cash",width:375,height:812,name:"cash-screen-mobile"},
  {route:"/cash",width:1280,height:900,name:"cash-screen-desktop"},
  {route:"/cash",width:375,height:812,name:"cash-add-modal-mobile"},
  {route:"/cash",width:1280,height:900,name:"cash-withdraw-modal-desktop"},
  {route:"/finance?action=CONTRIBUTION",width:375,height:812,name:"cash-add-mobile"},
  {route:"/finance?action=WITHDRAWAL",width:375,height:812,name:"cash-withdraw-mobile"},
  {route:"/reports",width:375,height:812,name:"reports-mobile"},
  {route:"/loans",width:375,height:812,name:"loans-mobile"},
  {route:"/clients",width:375,height:812,name:"clients-mobile"},
  {route:"/payments",width:375,height:812,name:"payments-mobile"},
  {route:"/loans?new=1",width:375,height:812,name:"loan-modal-mobile"},
  {route:"/payments?new=1",width:375,height:812,name:"payment-modal-mobile"},
];
const raster=new Set(["dashboard-320","dashboard-mobile","dashboard-desktop","collections-mobile","finance-mobile","cash-screen-mobile","cash-screen-desktop","cash-add-modal-mobile","cash-withdraw-modal-desktop","cash-add-mobile","cash-withdraw-mobile","loan-modal-mobile","payment-modal-mobile","login-mobile","login-desktop"]);
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const results=[];
  for(const c of cases){
    const context=await browser.newContext({viewport:{width:c.width,height:c.height},deviceScaleFactor:1,locale:"pt-BR",timezoneId:"America/Sao_Paulo",reducedMotion:"reduce"});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push("pageerror: "+e.message.slice(0,200)));
    page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text().slice(0,200));});
    await page.route("**/api/v1/**", async(route)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({error:false,data:mocked(route.request().url())})}));
    try {
      await page.goto("http://127.0.0.1:5173"+c.route,{waitUntil:"networkidle",timeout:30000});
      await page.waitForTimeout(800);
      if(c.name==="cash-add-modal-mobile"){await page.getByRole("button",{name:"Adicionar dinheiro"}).first().click();await page.waitForTimeout(250);}
      if(c.name==="cash-withdraw-modal-desktop"){await page.getByRole("button",{name:"Retirar dinheiro"}).first().click();await page.waitForTimeout(250);}
      const hasModal=await page.locator('[role="dialog"]').count();
      // Native select focus can show an OS picker backdrop in Chromium mobile screenshots.
      if(hasModal)await page.locator('[role="dialog"]').focus();
      const title=(await page.locator("h1").allTextContents()).join(" | ");
      const dimensions=await page.evaluate(()=>{
        const main=document.querySelector("main");
        const maxDoc=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
        const viewport=innerWidth;
        const offscreen=Array.from(document.querySelectorAll("main input, main button, main select")).filter(el=>{
          const r=el.getBoundingClientRect();
          const style=getComputedStyle(el);
          return style.display!=="none" && style.visibility!=="hidden" && r.width>0 && (r.right>viewport+3 || r.left < -3);
        }).slice(0,5).map(el=>({text:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,60),rect:[Math.round(el.getBoundingClientRect().left),Math.round(el.getBoundingClientRect().right)]}));
        return {documentWidth:maxDoc,viewportWidth:viewport,horizontalOverflow:maxDoc>viewport+2,offscreen,mainScrollHeight:main?.scrollHeight,mainClientHeight:main?.clientHeight};
      });
      const imgPath=path.join(out,c.name+".jpg");
      await page.screenshot({path:imgPath,type:"jpeg",quality:42,fullPage:false,animations:"disabled"});
      results.push({case:c.name,route:c.route,width:c.width,modal:hasModal,title,dimensions,errors});
      if(raster.has(c.name)){
        const b=fs.readFileSync(imgPath);
        process.stdout.write("AUDIT_IMAGE_BEGIN "+c.name+" "+b.length+"\n");
        const encoded=b.toString("base64");
        for(let i=0;i<encoded.length;i+=3000)process.stdout.write("AUDIT_IMAGE_DATA "+encoded.slice(i,i+3000)+"\n");
        process.stdout.write("AUDIT_IMAGE_END "+c.name+"\n");
      }
    }catch(e){results.push({case:c.name,failed:String(e).slice(0,350),errors});}
    await context.close();
  }
  fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(results,null,2));
  console.log("AUDIT_REPORT_BEGIN");
  console.log(JSON.stringify(results));
  console.log("AUDIT_REPORT_END");
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
