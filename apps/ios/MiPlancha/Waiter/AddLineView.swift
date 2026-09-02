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
    @State private var quantities: [String : Int] = [:]

    private var available: [(key: String, value: ProductInfo)] {
        service.products
            .filter { $0.value.stock > 0 }
            .sorted { $0.value.name < $1.value.name }
    }
    
    var body: some View {
        NavigationStack {
            List(available, id: \.key) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.value.name)
                        Text("Disponible \(item.value.stock)")
                            .font (.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Stepper(
                        "\(quantities[item.key, default: 0])",
                        value:Binding(
                            get: {quantities[item.key, default: 0]},
                            set: {quantities[item.key] = $0}
                        ),
                        in: 0...item.value.stock
                    )
                }
            }
            .navigationTitle("Nuevo pedido")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enviar") {
                        let lines = quantities
                            .filter { $0.value > 0 }
                            .map {(productId: $0.key, amount: $0.value)}
                        Task{
                            try? await service.addOrder(lines: lines)
                            dismiss()
                        }
                    }
                    .disabled(!quantities.values.contains {$0 > 0})
                }
                
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                
            }
        }
//        .onAppear {
//            selectedProductId = service.products
//                .filter { $0.value.stock > 0 }
//                .sorted(by: {$0.value.name < $1.value.name})
//                .first?.key ?? ""
//        }
    }
        
}

#Preview {
    Text("Mesa 1").sheet(isPresented: .constant(true)){
        AddLineView(service: LinesService())
    }
}
