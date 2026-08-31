//
//  AddLineView.swift
//  MiPlancha
//
//  Created by julio on 28/08/2026.
//
import SwiftUI

struct AddLineView: View {
    let service : LinesService
    @State private var selectedProductId = ""
    @State private var amount = 1
    @Environment(\.dismiss) private var  dismiss
    

    
    var body: some View {
        NavigationStack {
            Form {
                
                Picker("Producto", selection: $selectedProductId) {
                    let available = service.products.filter{$0.value.stock > 0}
                                                    .sorted{$0.value.name < $1.value.name}
                    
                    ForEach(available, id: \.key) { item in
                        Text(item.value.name).tag(item.key)
                    }
                    
                }
                
                Stepper("Cantidad: \(amount)", value: $amount, in: 1...20)
                
                Button("Añadir" ) {
                    guard !selectedProductId.isEmpty else { return }
                    
                    Task {
                        try? await service.addLine(productId: selectedProductId, amount: amount)
                        dismiss()
                    }
                }
                
            }
            .onAppear {
                selectedProductId = service.products
                    .filter { $0.value.stock > 0 }
                    .sorted(by: {$0.value.name < $1.value.name})
                    .first?.key ?? ""
            }
        }
        
    }
}

#Preview {
    Text("Mesa 1").sheet(isPresented: .constant(true)){
        AddLineView(service: LinesService())
    }
}
