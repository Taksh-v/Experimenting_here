#include<stdio.h>
#define size 5
#include<stdlib.h>

void push();
void pop();
void show();

int list[size];
int top = -1;

int main(){
    int input;
    while(input!=4){
        printf("1. Push\n2. Pop\n3. Show List of element\n4. Exit\n\nEnter your choice: ");
        scanf("%d",&input);
        switch(input){
            case 1:
                push();
                break;
            case 2:
                pop();
                break;
            case 3:
                show();
                break;
            case 4:
                printf("Session Ended !\nExitting...");
                exit(0);
                break;
            default:
                printf("Please enter right input\n");
        }
    }
    return 0;
}

void push(){
    int in;
    if (top==size-1){
        printf("Overflow !\n");
        return;
    }
    else{
        top++;
        printf("Enter the element : ");
        scanf("%d",&in);
        list[top] = in;
    }
}
void pop(){
    if (top==-1){
        printf("Underflow !\n");
        return;
    }
    else{
        top--;
    }
}
void show(){
    int i;
    if (top==-1)
        printf("Empty stack\n");
    else{
        printf("{");
        for(i=0;i<=top;i++){
            if (i==top)
                printf("%d",list[i]);
            else
                printf("%d, ",list[i]);
        }
        printf("}\n");
    }
}