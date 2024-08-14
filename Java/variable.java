class variable{
    static int a = 10; // Static variable
    public int Class;    
    void tehran(){
        Class = 130;  // Instance variable
        System.out.println("Instance variable = " + Class);
    }
    public static void main(String[] args){
        int age = 149;  // Local Variable
        variable acad = new variable();
        System.out.println("Static variable = " + a);
        //System.out.println("Instance variable = " + acad.tehran);
        acad.tehran();
        System.out.println("Local variable = " + age);
    }
}