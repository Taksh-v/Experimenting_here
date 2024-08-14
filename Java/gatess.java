class gatess{
    public static void main(String[] args){
        // -------------Initialising value of A and B ---------------
        int a[] = {0,0,1,1};
        int b[] = {0,1,0,1};

        // -------------Initialising value of different complement ------------- 
        int[] Acom1;
        Acom1 = new int[4];
        int[] Bcom1;
        Bcom1 = new int[4];
        int[] AorBcom1;
        AorBcom1 = new int[4];
        int[] AorBcom2;
        AorBcom2 = new int[4];
        int[] AandB = {};
        AandB = new int[4];

        // ------------- a complement -------------
        for (int i=0;i<4;i++){
            if (a[i]==1){
                Acom1[i]=0;
            }
            if (a[i]==0){
                Acom1[i]=1;
            }
        }
        // ---------------b complement --------------
        for (int i=0;i<4;i++){
            if (b[i]==1){
                Bcom1[i]=0;
            }
            if (b[i]==0){
                Bcom1[i]=1;
            }
        }
        // -------------A complement or B complement -----------------
        for (int i=0;i<4;i++){
            if (Acom1[i]==0 && Bcom1[i]==0){
                AorBcom1[i]=0;
            }
            else {
                AorBcom1[i]=1;
            }
        }
        // ------------------ (A complement or B complement) whole complement -------------------- 
        for (int i=0;i<4;i++){
            if (AorBcom1[i]==1){
                AorBcom2[i]=0;
            }
            if (AorBcom1[i]==0){
                AorBcom2[i]=1;
            }
        }
        // -------------------A and B -----------------
        for (int i=0;i<4;i++){
            if (a[i]==1 && b[i]==1){
                AandB[i]=1;
            }
            else {
                AandB[i]=0;
            }
        }

        // ---------------- Printing the table --------------
        System.out.println("|-----|-----|-----|-----|---------|------------|------|");
        System.out.println("|  A  |  B  |  A' |  B' |  A'+B'  |  (A'+B')'  |  AB  |");
        System.out.println("|  "+a[0]+"  |  "+b[0]+"  |  "+Acom1[0]+"  |  "+Bcom1[0]+"  |    "+AorBcom1[0]+"    |     "+AorBcom2[0]+"      |  "+AandB[0]+"   |");
        System.out.println("|  "+a[1]+"  |  "+b[1]+"  |  "+Acom1[1]+"  |  "+Bcom1[1]+"  |    "+AorBcom1[1]+"    |     "+AorBcom2[1]+"      |  "+AandB[1]+"   |");
        System.out.println("|  "+a[2]+"  |  "+b[2]+"  |  "+Acom1[2]+"  |  "+Bcom1[2]+"  |    "+AorBcom1[2]+"    |     "+AorBcom2[2]+"      |  "+AandB[2]+"   |");
        System.out.println("|  "+a[3]+"  |  "+b[3]+"  |  "+Acom1[3]+"  |  "+Bcom1[3]+"  |    "+AorBcom1[3]+"    |     "+AorBcom2[3]+"      |  "+AandB[3]+"   |");
        System.out.println("|-----|-----|-----|-----|---------|------------|------|");
    }
}
