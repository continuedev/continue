**FREE
/TITLE GETJOBTR Get Active Job Type:  Interactive, Batch, whatever
// -------------------------------------------------------------------
// This program is passed job name, user and job number and if the
// job is active, it returns the job type, otherwise returns ' '.
// Initially written to be called from GETOBJUR.
//=== Parameters =================================================
// Input Parm:
//   Job name -  10 char job name + 10 char user + 6 char job number,
//               or * for job program is running in.
// Out Parm:
//   Type - 1 character as returned by the QUSLJOB API.
//     I=Interactive, B=Batch, blank is job not active.
//     A=Autostart, M=subsystem monitor, R=spooled reader,
//     S=system job, W=spooled writer, X=SCPF system job.
//Compile: CRTBNDRPG PGM(GETJOBTR) SRCFILE(...) DBGVIEW(*LIST)
// -------------------------------------------------------------------
// 12/00/97 LENNON Original Writing
// 07/--/2021 Lennon Converted to **FREE and Linear module.
//            It was origially a standalone program. Perhaps it should
//            be a service program and perhaps some of the diract API
//            call should be in a service program.
// 02/--/2024 Set for soource in IFS
// -------------------------------------------------------------------
ctl-opt debug option(*nodebugio: *srcstmt)
    dftactgrp(*no) actgrp(*caller)
    main(Main);
/copy ../Copy_Mbrs/USPHDR.RPGLE
//=== CRTUSRSPC (QUSCTRUS) Parameters ================================
dcl-s CusName char(20) inz('GETJOBTR  QTEMP');
dcl-s CusAttr char(10) inz('GETJOBTR  ');
dcl-s CusIntSize bindec(9);
dcl-s CusIntVal char(1) inz(x'00');
dcl-s CusAut char(10) inz('*CHANGE');
dcl-s CusText char(50) inz('GETJOBTR  ');
dcl-s CusReplace char(10) inz('*NO');
dcl-s CusDomain char(10) inz('*DEFAULT');
//=== List Job (QUSLJOB) Parameters ==================================
dcl-s LJBFormat char(8) inz('JOBL0100');
dcl-s LJBQJobName char(26);
dcl-s LJBStatus char(10) inz('*ACTIVE');
//=== List Job Entry Layout ==========================================
dcl-ds LJLEntry based(ljptr);
    LJJobName char(10);
    LJJobUser char(10);
    LJJobNum char(6);
    LJJobIdent char(16);
    LJJobStus char(10);
    LJJobType char(1);
    LJJobSubT char(1);
    LJReserved char(2);
end-ds;
dcl-s LJPtr pointer inz(*null);
//=== Send Pgm Message (QMHSNDPM) Parameters =========================
dcl-s MSNMsgId char(7);
dcl-s MSNFile char(20) inz('QCPFMSG   *LIBL     ');
dcl-s MSNData char(1);
dcl-s MSNLength bindec(9);
dcl-s MSNType char(10) inz('*ESCAPE');
dcl-s MSNStackE char(10) inz('*CTLBDY');
dcl-s MSNStackC bindec(9) inz(1);
dcl-s MSNMsgKey char(4);
//=== API Error Code Structure =======================================
dcl-ds APIError len(272);
    APIEProv int(10) inz(0) pos(1);
    APIEAvail int(10) inz(0) pos(5);
    APIErrId char(7) pos(9);
    APIErrRsv char(1);
    APIEData char(256);
end-ds;
dcl-pr p_qusdltus extpgm('QUSDLTUS');
    *n char(20); // CusName
    *n char(272); // APIError
end-pr;
//------------------------------------------------------
dcl-pr p_qmhsndpm extpgm('QMHSNDPM');
    *n char(7); // MSNMsgId
    *n char(20); // MSNFile
    *n char(256); // APIEData
    *n bindec(9); // MSNLength
    *n char(10); // MSNType
    *n char(10); // MSNStackE
    *n bindec(9); // MSNStackC
    *n char(4); // MSNMsgKey
    *n char(272); // APIError
end-pr;
//------------------------------------------------------
dcl-pr p_quscrtus extpgm('QUSCRTUS');
    *n char(20); // CusName
    *n char(10); // CusAttr
    *n bindec(9); // CusIntSize
    *n char(1); // CusIntVal
    *n char(10); // CusAut
    *n char(50); // Custext
    *n char(10); // CusReplace
    *n char(272); // APIError
    *n char(10); // CusDomain
end-pr;
//------------------------------------------------------
dcl-pr p_qusptrus extpgm('QUSPTRUS');
    *n char(20); // CusName
    *n pointer; // UspPtr
end-pr;
//------------------------------------------------------
dcl-pr p_qusljob extpgm('QUSLJOB');
    *n char(20); // CusName
    *n char(8); // LJBFormat
    *n char(26); // LJBQJobName
    *n char(10); // LJBStatus
end-pr;
//=== Main ===========================================================
dcl-proc Main;
    // -----------------------------------
    dcl-pi *n extpgm('GETJOBTR');
        pQJob char(26);
        pType char(1);
    end-pi;
    //=== Delete the User Space ======================================
    APIEProv=%LEN(APIError);
    p_QUSDLTUS(
            CusName:
            APIError);
    // If user space doesn't exist, accept message CPF2105, else
    // something nasty wrong - pass errors back
    if APIEAvail <> 0 and APIErrId <> 'CPF2105';
        APIEProv=0;
        MSNMsgId=APIErrId;
        MSNLength=APIEAvail-16;
        p_QMHSNDPM(
            MSNMsgId:
            MSNFile:
            APIEData:
            MSNLength:
            MSNType:
            MSNStackE:
            MSNStackC:
            MSNMsgKey:
            APIError);
    endif;
    // === Create User Space =========================================
    // We only expect one entry back since job is fully qualified, but
    // allocate enough for 10 entries in case entry size expands.
    CusIntSize=%size(UspHdr) + (%size(LJLentry)*10);
    LJBQJobname=pQJob;
    // === Create the User Space =====================================
    APIEProv = 0;
    p_QUSCRTUS(
            CusName:
            CusAttr:
            CusIntSize:
            CusIntVal:
            CusAut:
            Custext:
            CusReplace:
            APIError:
            CusDomain);
    // === Get Pointer to User Space =================================
    p_QUSPTRUS(CusName: UspPtr);
    // === Get Job Info ==============================================
    p_QUSLJOB(
            CusName:
            LJBFormat:
            LJBQJobName:
            LJBStatus);
    if UspLst#Ent>0;
        LJPtr=UspPtr+UspLstOfs;
        // All that code just to execute this one instruction...
        pType=LJJobType;
    else;
        pType=' ';
    endif;
    // === Return to Caller ==========================================
    // Leave LR Off - this isn't very big.
    return;
    //
end-proc;
