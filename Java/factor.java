import java.util.Scanner;
class factor{
	public static void main(String[] args){
		Scanner scanner= new Scanner(System.in);
		System.out.print("Enter an integer : ");
		int integ = scanner.nextInt();
		int intiger = 0; 
		while (integ!=intiger){
			intiger=intiger+1;
			if (integ%intiger==0){
				System.out.print(intiger + " ");
			}
		}
	}
}